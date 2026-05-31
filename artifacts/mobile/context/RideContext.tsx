import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coords,
  NegotiationMessage,
  Ride,
  RideLocation,
  VehicleType,
} from '@/types';
import { API_TO_LEGACY_VEHICLE, LEGACY_TO_API_VEHICLE } from '@/services/vehicleTypes';
import * as rideService from '@/services/rides';
import * as driverRideService from '@/services/driverRides';
import { RideWebSocket } from '@/services/websocket';

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
const CUSTOMER_RIDE_KEY = '@taravelis_customer_ride';
const DRIVER_RIDE_KEY   = '@taravelis_driver_ride';

// Statuses where a ride is still "in flight" — these are persisted.
// Terminal states (completed, cancelled) and idle are not.
const CUSTOMER_ACTIVE_STATUSES = new Set<Ride['status']>([
  'searching', 'driver_assigned', 'negotiating', 'confirmed',
  'arriving', 'arrived', 'in_progress',
]);
const DRIVER_ACTIVE_STATUSES = new Set<Ride['status']>([
  'confirmed', 'arriving', 'arrived', 'in_progress',
]);

// ─── Types ────────────────────────────────────────────────────────────────────
interface RideContextType {
  currentRide: Ride | null;
  rideHistory: Ride[];
  driverLocation: Coords | null;
  pendingRequest: Ride | null;
  createRide: (pickup: RideLocation, destination: RideLocation, vehicleType: VehicleType) => Promise<void>;
  cancelRide: () => void;
  pauseDriverMatching: () => void;
  resumeDriverMatching: () => void;
  isMatchingPaused: boolean;
  counterOffer: (amount: number) => Promise<void>;
  sendDriverOffer: (amount: number) => void;
  acceptDriverOffer: () => void;
  acceptCustomerOffer: () => void;
  declineDriverOffer: () => void;
  completeRide: () => void;
  markArrived: () => void;
  startJourney: () => void;
  acceptRideRequest: () => void;
  declineRideRequest: () => void;
  initDriverSession: () => void;
  /** Call on the customer home screen mount to recover in-progress rides after restart. */
  initCustomerSession: () => Promise<void>;
  riderAcceptWithFare: (amount: number) => void;
  loadHistory: () => Promise<void>;
  /** Send a real-time GPS position through the driver WS connection. */
  sendWsLocationUpdate: (lat: number, lng: number) => void;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

// ─── Mappers ──────────────────────────────────────────────────────────────────

const toRideStatus = (status?: string): Ride['status'] => {
  switch (status) {
    case 'SEARCHING':      return 'searching';
    case 'MATCHED':        return 'driver_assigned';
    case 'NEGOTIATING':    return 'negotiating';
    case 'CONFIRMED':      return 'confirmed';
    case 'DRIVER_EN_ROUTE':return 'arriving';
    case 'DRIVER_ARRIVED': return 'arrived';
    case 'IN_PROGRESS':    return 'in_progress';
    case 'COMPLETED':      return 'completed';
    case 'CANCELLED':      return 'cancelled';
    default:               return 'idle';
  }
};

const mapBackendRideToUiRide = (data: any): Ride => {
  const apiType = String(data.transport_type ?? '') as keyof typeof API_TO_LEGACY_VEHICLE;
  const transportType = API_TO_LEGACY_VEHICLE[apiType] ?? 'moto';
  return {
    id: data.id,
    customerId: data.customer_id ?? '',
    customerName: data.customer_name ?? '',
    customerPhone: data.customer_phone ?? '',
    driverId: data.driver_id ?? undefined,
    vehicleType: transportType,
    pickup: {
      latitude: data.pickup_lat ?? data.pickup?.lat ?? 0,
      longitude: data.pickup_lng ?? data.pickup?.lng ?? 0,
      address: data.pickup_address ?? data.pickup?.address ?? '',
      locationType: 'precise',
    },
    destination: {
      latitude: data.dest_lat ?? data.destination_lat ?? data.destination?.lat ?? 0,
      longitude: data.dest_lng ?? data.destination_lng ?? data.destination?.lng ?? 0,
      address: data.destination_address ?? data.destination?.address ?? '',
      locationType: 'precise',
    },
    status: toRideStatus(data.status),
    distance: Number(data.estimated_distance_km ?? 0),
    duration: 0,
    suggestedFare: Number(data.estimated_fare_rwf ?? 0),
    agreedFare: data.agreed_fare ? Number(data.agreed_fare) : undefined,
    negotiation: [],
    createdAt: data.created_at ?? new Date().toISOString(),
    completedAt: data.completed_at ?? undefined,
    arrivedAt: data.driver_arrived_at ?? undefined,
    waitStartedAt: data.driver_arrived_at ?? undefined,
  };
};

const mapDriverRequestToRide = (payload: any): Ride => {
  const apiType = String(payload?.transport_type ?? '') as keyof typeof API_TO_LEGACY_VEHICLE;
  const transportType = API_TO_LEGACY_VEHICLE[apiType] ?? 'moto';
  return {
    id: payload.ride_id,
    customerId: '',
    customerName: payload.customer_name ?? 'Customer',
    customerPhone: payload.customer_phone ?? '',
    vehicleType: transportType,
    pickup: {
      latitude: Number(payload.pickup_lat ?? 0),
      longitude: Number(payload.pickup_lng ?? 0),
      address: payload.pickup_address ?? 'Pickup',
      locationType: 'precise',
    },
    destination: {
      latitude: Number(payload.dest_lat ?? 0),
      longitude: Number(payload.dest_lng ?? 0),
      address: payload.dest_address ?? 'Destination',
      locationType: 'precise',
    },
    status: 'searching',
    distance: Number(payload.distance_km ?? 0),
    duration: 0,
    suggestedFare: Number(payload.suggested_fare ?? 0),
    negotiation: [],
    createdAt: new Date().toISOString(),
  };
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Ride | null>(null);
  const [isMatchingPaused, setIsMatchingPaused] = useState(false);
  const wsRef = useRef<RideWebSocket | null>(null);

  // ── Persistence ─────────────────────────────────────────────────────────────
  // Whenever the ride changes, snapshot it to AsyncStorage keyed by role.
  // Terminal states and null clear the snapshot so the next app launch starts
  // clean.  The driver-side snapshot is lighter — drivers already have
  // initDriverSession pulling from the backend, so we only need it to survive
  // the WS reconnect window.
  useEffect(() => {
    if (currentRide && CUSTOMER_ACTIVE_STATUSES.has(currentRide.status)) {
      AsyncStorage.setItem(CUSTOMER_RIDE_KEY, JSON.stringify(currentRide)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CUSTOMER_RIDE_KEY).catch(() => {});
    }
  }, [currentRide]);

  useEffect(() => {
    if (currentRide && DRIVER_ACTIVE_STATUSES.has(currentRide.status)) {
      AsyncStorage.setItem(DRIVER_RIDE_KEY, JSON.stringify({ id: currentRide.id })).catch(() => {});
    } else {
      AsyncStorage.removeItem(DRIVER_RIDE_KEY).catch(() => {});
    }
  }, [currentRide]);

  // ── WS helpers ───────────────────────────────────────────────────────────────

  const disconnectWS = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
  }, []);

  const connectCustomerWS = useCallback(async (rideId: string) => {
    disconnectWS();
    const ws = new RideWebSocket();
    wsRef.current = ws;
    await ws.connect('/ws/customer', { ride_id: rideId });

    ws
      // ── State replay (server pushes current status on every connect) ────────
      .on('ride_state', payload => {
        const status = toRideStatus(payload?.status);
        if (!status || status === 'idle') return;
        setCurrentRide(prev => prev ? { ...prev, status } : null);
        if (typeof payload?.driver_lat === 'number' && typeof payload?.driver_lng === 'number') {
          setDriverLocation({ latitude: payload.driver_lat, longitude: payload.driver_lng });
        }
      })
      // ── Live events ─────────────────────────────────────────────────────────
      .on('driver_matched', payload => {
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'negotiating',
          driverId: payload?.driver_id ?? prev.driverId,
          driver: payload ? {
            id: payload.driver_id ?? '',
            name: payload.driver_name ?? 'Driver',
            phone: payload.driver_phone ?? '',
            vehicleType: prev.vehicleType,
            plateNumber: payload.vehicle_plate ?? '',
            location: { latitude: payload.lat ?? prev.pickup.latitude, longitude: payload.lng ?? prev.pickup.longitude },
            rating: Number(payload.rating ?? 5),
            eta: Number(payload.eta_minutes ?? 0),
          } : prev.driver,
        } : null);
      })
      .on('negotiation_message', payload => {
        const amount = Number(payload?.amount ?? 0);
        if (!amount) return;
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'negotiating',
          negotiation: [
            ...prev.negotiation,
            {
              id: `${Date.now()}-${Math.random()}`,
              sender: 'driver',
              type: 'offer',
              amount,
              timestamp: new Date().toISOString(),
            } as NegotiationMessage,
          ],
        } : null);
      })
      .on('ride_confirmed', payload => {
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'confirmed',
          agreedFare: Number(payload?.agreed_fare ?? prev.agreedFare ?? 0),
        } : null);
      })
      .on('driver_en_route', () => {
        setCurrentRide(prev => prev ? { ...prev, status: 'arriving' } : null);
      })
      .on('driver_arrived', () => {
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'arrived',
          arrivedAt: new Date().toISOString(),
          waitStartedAt: new Date().toISOString(),
        } : null);
      })
      .on('driver_location', payload => {
        if (typeof payload?.lat === 'number' && typeof payload?.lng === 'number') {
          setDriverLocation({ latitude: payload.lat, longitude: payload.lng });
        }
      })
      .on('ride_completed', payload => {
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'completed',
          completedAt: new Date().toISOString(),
          agreedFare: Number(payload?.final_fare ?? prev.agreedFare ?? 0),
        } : null);
      })
      .on('ride_cancelled', () => {
        setCurrentRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
      });
  }, [disconnectWS]);

  const connectDriverWS = useCallback(async () => {
    if (wsRef.current) return;
    const ws = new RideWebSocket();
    wsRef.current = ws;
    await ws.connect('/ws/driver');
    ws
      // ── State replay ─────────────────────────────────────────────────────────
      .on('ride_state', payload => {
        // Only update status — don't overwrite the full ride object which may
        // have richer local data (customer name, negotiation messages, etc.)
        const status = toRideStatus(payload?.status);
        if (!status || status === 'idle') return;
        setCurrentRide(prev => prev ? { ...prev, status } : null);
      })
      // ── Live events ─────────────────────────────────────────────────────────
      .on('ride_request', payload => {
        setPendingRequest(mapDriverRequestToRide(payload));
      })
      .on('ride_cancelled', payload => {
        if (payload?.ride_id && currentRide?.id === payload.ride_id) {
          setCurrentRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
        }
      })
      .on('negotiation_message', payload => {
        if (payload?.proposed_by !== 'CUSTOMER') return;
        const amount = Number(payload?.amount ?? 0);
        if (!amount) return;
        setCurrentRide(prev => prev ? {
          ...prev,
          negotiation: [...prev.negotiation, {
            id: `${Date.now()}-${Math.random()}`,
            sender: 'customer',
            type: 'offer',
            amount,
            timestamp: new Date().toISOString(),
          } as NegotiationMessage],
        } : null);
      })
      .on('ride_confirmed', payload => {
        const agreedFare = Number(payload?.agreed_fare ?? 0);
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'confirmed',
          ...(agreedFare > 0 ? { agreedFare } : {}),
        } : null);
      });
  }, [currentRide?.id]);

  // ── Session recovery ─────────────────────────────────────────────────────────
  //
  // Customer — called from the customer home screen on mount.
  // Flow:
  //   1. Hit GET /customer/rides/active to get the live ride from the server
  //   2. If none, check AsyncStorage for a snapshot (catches the window between
  //      server clears the ride and the snapshot is deleted)
  //   3. Verify the ride is still in an active status
  //   4. Restore currentRide + reconnect customer WS
  //   5. WS immediately sends ride_state to sync the exact status
  const initCustomerSession = useCallback(async () => {
    try {
      // ① Try the live backend first — most authoritative.
      let liveRide = await rideService.getActiveCustomerRide();

      // ② Fall back to snapshot if backend returns nothing.
      if (!liveRide) {
        const raw = await AsyncStorage.getItem(CUSTOMER_RIDE_KEY);
        if (!raw) return;
        const snapshot = JSON.parse(raw) as Ride;
        if (!snapshot?.id) { await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY); return; }
        // Re-verify the snapshot ride with the backend.
        liveRide = await rideService.getRide(snapshot.id).catch(() => null);
      }

      if (!liveRide) { await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY); return; }

      const ride = mapBackendRideToUiRide(liveRide);
      if (!CUSTOMER_ACTIVE_STATUSES.has(ride.status)) {
        await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY);
        return;
      }

      setCurrentRide(ride);
      // Reconnect WS — server will push ride_state immediately on connect.
      await connectCustomerWS(ride.id);
    } catch {
      // Non-fatal: customer just sees the home screen without an in-progress ride.
    }
  }, [connectCustomerWS]);

  // Driver — mirrors what the existing initDriverSession did, now also handles
  // WS reconnect for a ride that was active before the app was killed.
  const initDriverSession = useCallback(() => {
    connectDriverWS().catch(() => {});
    // Fetch active ride from backend (Redis → DB fallback).
    driverRideService.getActiveRideForDriver()
      .then(data => {
        if (data) setCurrentRide(mapBackendRideToUiRide(data));
      })
      .catch(() => {});
  }, [connectDriverWS]);

  // ── Ride actions ─────────────────────────────────────────────────────────────

  const createRide = useCallback(async (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
  ) => {
    if (currentRide && CUSTOMER_ACTIVE_STATUSES.has(currentRide.status)) return;

    const payload = {
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      pickup_address: pickup.address ?? 'Pickup',
      dest_lat: destination.latitude,
      dest_lng: destination.longitude,
      dest_address: destination.address ?? 'Destination',
      transport_type: LEGACY_TO_API_VEHICLE[vehicleType],
    };
    const data = await rideService.createRide(payload);
    const ride: Ride = {
      id: data.ride_id,
      customerId: '',
      vehicleType,
      pickup,
      destination,
      status: 'searching',
      distance: 0,
      duration: 0,
      suggestedFare: 0,
      negotiation: [],
      createdAt: new Date().toISOString(),
    };

    setCurrentRide(ride);
    await connectCustomerWS(data.ride_id);
  }, [connectCustomerWS, currentRide]);

  const cancelRide = useCallback(() => {
    const activeRideId = currentRide?.id;
    if (!activeRideId) return;
    const isDriverFlow = ['arriving', 'arrived', 'in_progress'].includes(currentRide?.status ?? '');
    if (isDriverFlow) {
      driverRideService.cancelRideAsDriver(activeRideId).catch(() => {});
    } else {
      rideService.cancelRide(activeRideId, 'customer cancelled').catch(() => {});
    }
    disconnectWS();
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
    setDriverLocation(null);
  }, [currentRide?.id, currentRide?.status, disconnectWS]);

  const counterOffer = useCallback((amount: number): Promise<void> => {
    if (!currentRide?.id) return Promise.resolve();
    setCurrentRide(prev => prev ? {
      ...prev,
      negotiation: [...prev.negotiation, {
        id: `${Date.now()}-${Math.random()}`,
        sender: 'customer',
        type: 'offer',
        amount,
        timestamp: new Date().toISOString(),
      } as NegotiationMessage],
    } : null);
    return rideService.proposeNegotiation(currentRide.id, amount);
  }, [currentRide?.id]);

  const acceptDriverOffer = useCallback(async () => {
    if (!currentRide?.id) return;
    await rideService.acceptNegotiation(currentRide.id);
    setCurrentRide(prev => prev ? { ...prev, status: 'confirmed' } : null);
  }, [currentRide?.id]);

  const sendDriverOffer = useCallback((amount: number) => {
    if (!currentRide?.id || !amount) return;
    driverRideService.proposeDriverFare(currentRide.id, amount).catch(() => {});
    setCurrentRide(prev => prev ? {
      ...prev,
      negotiation: [...prev.negotiation, {
        id: `${Date.now()}-${Math.random()}`,
        sender: 'driver',
        type: 'offer',
        amount,
        timestamp: new Date().toISOString(),
      }],
    } : null);
  }, [currentRide?.id]);

  const acceptCustomerOffer = useCallback(async () => {
    if (!currentRide?.id) return;
    await driverRideService.acceptCustomerFare(currentRide.id);
    const refreshed = await driverRideService.getRideForDriver(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(refreshed));
  }, [currentRide?.id]);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const markArrived = useCallback(async () => {
    if (!currentRide?.id) return;
    await driverRideService.markArrived(currentRide.id);
    const refreshed = await driverRideService.getRideForDriver(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(refreshed));
  }, [currentRide?.id]);

  const startJourney = useCallback(async () => {
    if (!currentRide?.id) return;
    await driverRideService.startRide(currentRide.id);
    const refreshed = await driverRideService.getRideForDriver(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(refreshed));
  }, [currentRide?.id]);

  const completeRide = useCallback(async () => {
    if (!currentRide?.id) return;
    const isDriverFlow = ['arrived', 'in_progress', 'arriving', 'confirmed'].includes(currentRide.status);
    if (isDriverFlow) {
      await driverRideService.completeRide(currentRide.id);
      setCurrentRide(null);
      return;
    }
    const data = await rideService.getRide(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(data));
  }, [currentRide?.id, currentRide?.status]);

  const acceptRideRequest = useCallback(async () => {
    if (!pendingRequest?.id) return;
    await driverRideService.acceptRideRequest(pendingRequest.id);
    const data = await driverRideService.getRideForDriver(pendingRequest.id);
    setCurrentRide({
      ...mapBackendRideToUiRide(data),
      customerName: pendingRequest.customerName,
      customerPhone: pendingRequest.customerPhone,
      suggestedFare: pendingRequest.suggestedFare,
    });
    setPendingRequest(null);
  }, [pendingRequest]);

  const declineRideRequest = useCallback(async () => {
    if (!pendingRequest?.id) return;
    await driverRideService.declineRideRequest(pendingRequest.id);
    setPendingRequest(null);
  }, [pendingRequest]);

  const riderAcceptWithFare = useCallback(async (amount: number) => {
    if (!currentRide?.id) return;
    await driverRideService.lockManualFare(currentRide.id, amount);
    const refreshed = await driverRideService.getRideForDriver(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(refreshed));
  }, [currentRide?.id]);

  const sendWsLocationUpdate = useCallback((lat: number, lng: number) => {
    wsRef.current?.send({ type: 'location_update', lat, lng });
  }, []);

  const pauseDriverMatching = useCallback(() => setIsMatchingPaused(true), []);
  const resumeDriverMatching = useCallback(() => setIsMatchingPaused(false), []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await rideService.listRides(20, 0);
      const rides = Array.isArray(data?.rides) ? data.rides.map(mapBackendRideToUiRide) : [];
      setRideHistory(rides);
    } catch {
      // Non-fatal — history is a read-only view, stale data is preferable to a crash.
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      currentRide,
      rideHistory,
      driverLocation,
      pendingRequest,
      createRide,
      cancelRide,
      pauseDriverMatching,
      resumeDriverMatching,
      isMatchingPaused,
      counterOffer,
      sendDriverOffer,
      acceptDriverOffer,
      acceptCustomerOffer,
      declineDriverOffer,
      completeRide,
      markArrived,
      startJourney,
      acceptRideRequest,
      declineRideRequest,
      initDriverSession,
      initCustomerSession,
      riderAcceptWithFare,
      loadHistory,
      sendWsLocationUpdate,
    }),
    [
      acceptCustomerOffer,
      acceptDriverOffer,
      acceptRideRequest,
      cancelRide,
      completeRide,
      counterOffer,
      createRide,
      declineDriverOffer,
      declineRideRequest,
      driverLocation,
      loadHistory,
      markArrived,
      pendingRequest,
      rideHistory,
      riderAcceptWithFare,
      sendDriverOffer,
      initDriverSession,
      initCustomerSession,
      startJourney,
      currentRide,
      isMatchingPaused,
      sendWsLocationUpdate,
    ],
  );

  return (
    <RideContext.Provider value={contextValue}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used within RideProvider');
  return ctx;
}
