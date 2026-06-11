import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookingFormDraft,
  Coords,
  NegotiationMessage,
  Ride,
  RideLocation,
  VehicleType,
} from '@/types';
import { API_TO_LEGACY_VEHICLE, LEGACY_TO_API_VEHICLE, type LegacyVehicleType } from '@/services/vehicleTypes';
import * as rideService from '@/services/rides';
import * as driverRideService from '@/services/driverRides';
import { RideWebSocket } from '@/services/websocket';
import { reportOperationalFailure } from '@/observability/monitoring';
import { useOptionalDriverEntitlement } from '@/context/DriverEntitlementContext';
import { RideContextType } from './rideTypes';
import { cloneBookingDraft } from './rideUtils';

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
const CUSTOMER_RIDE_KEY = '@taravelis_customer_ride';
const DRIVER_RIDE_KEY = '@taravelis_driver_ride';

// Statuses where a ride is still "in flight" — these are persisted.
const CUSTOMER_ACTIVE_STATUSES = new Set<Ride['status']>([
  'searching', 'driver_assigned', 'negotiating', 'confirmed',
  'arriving', 'arrived', 'in_progress',
]);
const DRIVER_ACTIVE_STATUSES = new Set<Ride['status']>([
  'confirmed', 'arriving', 'arrived', 'in_progress',
]);

const RideContext = createContext<RideContextType | undefined>(undefined);

// ─── Mappers ──────────────────────────────────────────────────────────────────

const toRideStatus = (status?: string): Ride['status'] => {
  switch (status) {
    case 'SEARCHING':       return 'searching';
    case 'MATCHED':         return 'driver_assigned';
    case 'NEGOTIATING':     return 'negotiating';
    case 'CONFIRMED':       return 'confirmed';
    case 'DRIVER_EN_ROUTE': return 'arriving';
    case 'DRIVER_ARRIVED':  return 'arrived';
    case 'IN_PROGRESS':     return 'in_progress';
    case 'COMPLETED':       return 'completed';
    case 'CANCELLED':       return 'cancelled';
    default:                return 'idle';
  }
};

const toLegacyVehicle = (apiType?: string): VehicleType => {
  const key = String(apiType ?? '') as keyof typeof API_TO_LEGACY_VEHICLE;
  return (API_TO_LEGACY_VEHICLE[key] ?? 'moto') as VehicleType;
};

// Develop's VehicleType includes 'rifani', which has no distinct backend enum
// yet; fall back to the uppercased key so the request still carries a value.
const toApiVehicle = (vehicleType: VehicleType): string =>
  LEGACY_TO_API_VEHICLE[vehicleType as LegacyVehicleType] ?? vehicleType.toUpperCase();

const mapBackendRideToUiRide = (data: any): Ride => ({
  id: data.id,
  customerId: data.customer_id ?? '',
  customerName: data.customer_name ?? '',
  customerPhone: data.customer_phone ?? '',
  driverId: data.driver_id ?? undefined,
  vehicleType: toLegacyVehicle(data.transport_type),
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
});

const mapDriverRequestToRide = (payload: any): Ride => ({
  id: payload.ride_id,
  customerId: '',
  customerName: payload.customer_name ?? 'Customer',
  customerPhone: payload.customer_phone ?? '',
  vehicleType: toLegacyVehicle(payload?.transport_type),
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
});

const offerMessage = (sender: 'customer' | 'driver', amount: number): NegotiationMessage => ({
  id: `${Date.now()}-${Math.random()}`,
  sender,
  type: 'offer',
  amount,
  timestamp: new Date().toISOString(),
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RideProvider({ children }: { children: React.ReactNode }) {
  const driverEntitlement = useOptionalDriverEntitlement();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [cancelledSearchDraft, setCancelledSearchDraft] = useState<BookingFormDraft | null>(null);
  const [restoreBookingOnHomeFocus, setRestoreBookingOnHomeFocus] = useState(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Ride | null>(null);
  const [isMatchingPaused, setIsMatchingPaused] = useState(false);

  const wsRef = useRef<RideWebSocket | null>(null);
  // Which side of the ride this device is acting as. Drives cancel/complete
  // endpoint selection, since develop's screens call cancelRide()/completeRide()
  // with no role argument.
  const activeRoleRef = useRef<'customer' | 'driver'>('customer');
  // Serialises driver state transitions so a double-tap can't fire two requests.
  const transitionLockRef = useRef(false);
  const currentRideRef = useRef(currentRide);
  const pendingRequestRef = useRef(pendingRequest);
  currentRideRef.current = currentRide;
  pendingRequestRef.current = pendingRequest;

  // ── Persistence ────────────────────────────────────────────────────────────
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

  // ── WebSocket ──────────────────────────────────────────────────────────────

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
      .on('ride_state', payload => {
        const status = toRideStatus(payload?.status);
        if (!status || status === 'idle') return;
        setCurrentRide(prev => (prev ? { ...prev, status } : null));
        if (typeof payload?.driver_lat === 'number' && typeof payload?.driver_lng === 'number') {
          setDriverLocation({ latitude: payload.driver_lat, longitude: payload.driver_lng });
        }
      })
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
            location: {
              latitude: payload.lat ?? prev.pickup.latitude,
              longitude: payload.lng ?? prev.pickup.longitude,
            },
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
          negotiation: [...prev.negotiation, offerMessage('driver', amount)],
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
        setCurrentRide(prev => (prev ? { ...prev, status: 'arriving' } : null));
      })
      .on('driver_arrived', () => {
        setCurrentRide(prev => prev ? {
          ...prev,
          status: 'arrived',
          arrivedAt: new Date().toISOString(),
          waitStartedAt: new Date().toISOString(),
        } : null);
      })
      .on('ride_started', () => {
        setCurrentRide(prev => (prev ? { ...prev, status: 'in_progress' } : null));
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
        // The ride is done — drop the resume-booking draft so returning home
        // doesn't reopen the destination picker. (It's only for cancelled searches.)
        setCancelledSearchDraft(null);
        setRestoreBookingOnHomeFocus(false);
      })
      .on('ride_cancelled', () => {
        setCurrentRide(prev => (prev ? { ...prev, status: 'cancelled' } : null));
      });
  }, [disconnectWS]);

  const connectDriverWS = useCallback(async () => {
    if (wsRef.current) return;
    const ws = new RideWebSocket();
    wsRef.current = ws;
    await ws.connect('/ws/driver');
    ws
      .on('ride_state', payload => {
        const status = toRideStatus(payload?.status);
        if (!status || status === 'idle') return;
        setCurrentRide(prev => (prev ? { ...prev, status } : null));
      })
      .on('ride_request', payload => {
        setPendingRequest(mapDriverRequestToRide(payload));
      })
      .on('ride_cancelled', payload => {
        if (payload?.ride_id && currentRideRef.current?.id === payload.ride_id) {
          setCurrentRide(prev => (prev ? { ...prev, status: 'cancelled' } : null));
        }
      })
      .on('negotiation_message', payload => {
        if (payload?.proposed_by !== 'CUSTOMER') return;
        const amount = Number(payload?.amount ?? 0);
        if (!amount) return;
        setCurrentRide(prev => prev ? {
          ...prev,
          negotiation: [...prev.negotiation, offerMessage('customer', amount)],
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
  }, []);

  // ── Session recovery ────────────────────────────────────────────────────────

  const initCustomerSession = useCallback(async () => {
    activeRoleRef.current = 'customer';
    try {
      let liveRide = await rideService.getActiveCustomerRide();
      if (!liveRide) {
        const raw = await AsyncStorage.getItem(CUSTOMER_RIDE_KEY);
        if (!raw) return;
        const snapshot = JSON.parse(raw) as Ride;
        if (!snapshot?.id) { await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY); return; }
        liveRide = await rideService.getRide(snapshot.id).catch(() => null);
      }
      if (!liveRide) { await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY); return; }

      const ride = mapBackendRideToUiRide(liveRide);
      if (ride.status === 'completed') {
        await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY);
        setCurrentRide(ride);
        return;
      }
      if (!CUSTOMER_ACTIVE_STATUSES.has(ride.status)) {
        await AsyncStorage.removeItem(CUSTOMER_RIDE_KEY);
        return;
      }
      setCurrentRide(ride);
      await connectCustomerWS(ride.id);
    } catch (error) {
      reportOperationalFailure('ride.customer.session', error);
    }
  }, [connectCustomerWS]);

  const initDriverSession = useCallback(() => {
    activeRoleRef.current = 'driver';
    connectDriverWS().catch(() => {});
    driverRideService.getActiveRideForDriver()
      .then(data => {
        if (!data) return;
        // Guard against stale ghost rides (IN_PROGRESS > 4h is a test artifact).
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        const startedAt = data.started_at ? new Date(data.started_at).getTime() : 0;
        if (startedAt > 0 && data.status === 'IN_PROGRESS' && Date.now() - startedAt > FOUR_HOURS_MS) {
          return;
        }
        setCurrentRide(mapBackendRideToUiRide(data));
      })
      .catch(() => {});
  }, [connectDriverWS]);

  // ── Draft helpers ────────────────────────────────────────────────────────────

  const clearCancelledSearchDraft = useCallback(() => {
    setCancelledSearchDraft(null);
    setRestoreBookingOnHomeFocus(false);
  }, []);

  const clearRestoreBookingOnHomeFocus = useCallback(() => {
    setRestoreBookingOnHomeFocus(false);
  }, []);

  // ── Customer ride actions ─────────────────────────────────────────────────────

  const createRide = useCallback(async (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
    destText = '',
  ) => {
    if (currentRideRef.current && CUSTOMER_ACTIVE_STATUSES.has(currentRideRef.current.status)) return;
    activeRoleRef.current = 'customer';

    const data = await rideService.createRide({
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      pickup_address: pickup.address ?? 'Pickup',
      dest_lat: destination.latitude,
      dest_lng: destination.longitude,
      dest_address: destination.address ?? 'Destination',
      transport_type: toApiVehicle(vehicleType) as any,
    });

    const ride: Ride = {
      id: data.ride_id ?? data.id,
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

    const displayDestText = destText.trim() || destination.address?.trim() || '';
    setCancelledSearchDraft(cloneBookingDraft(pickup, destination, vehicleType, displayDestText));
    setIsMatchingPaused(false);
    setCurrentRide(ride);
    await connectCustomerWS(ride.id);
  }, [connectCustomerWS]);

  const cancelRide = useCallback(() => {
    const activeRideId = currentRideRef.current?.id;
    if (!activeRideId) return;
    if (activeRoleRef.current === 'driver') {
      driverRideService.cancelRideAsDriver(activeRideId).catch(() => {});
    } else {
      rideService.cancelRide(activeRideId, 'customer cancelled').catch(() => {});
    }
    disconnectWS();
    setRestoreBookingOnHomeFocus(true);
    setCurrentRide(prev => (prev ? { ...prev, status: 'cancelled' } : null));
    setDriverLocation(null);
  }, [disconnectWS]);

  const counterOffer = useCallback((amount: number) => {
    const rideId = currentRideRef.current?.id;
    if (!rideId || amount <= 0) return;
    setCurrentRide(prev => prev ? {
      ...prev,
      negotiation: [...prev.negotiation, offerMessage('customer', amount)],
    } : null);
    rideService.proposeNegotiation(rideId, amount).catch(() => {});
  }, []);

  const acceptDriverOffer = useCallback(() => {
    const rideId = currentRideRef.current?.id;
    if (!rideId) return;
    rideService.acceptNegotiation(rideId)
      .then(() => setCurrentRide(prev => (prev ? { ...prev, status: 'confirmed' } : null)))
      .catch(() => {});
  }, []);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  // ── Driver ride actions ───────────────────────────────────────────────────────

  const sendDriverOffer = useCallback((amount: number) => {
    const rideId = currentRideRef.current?.id;
    if (!rideId || amount <= 0) return;
    driverRideService.proposeDriverFare(rideId, amount).catch(() => {});
    setCurrentRide(prev => prev ? {
      ...prev,
      negotiation: [...prev.negotiation, offerMessage('driver', amount)],
    } : null);
  }, []);

  const acceptCustomerOffer = useCallback(async () => {
    const rideId = currentRideRef.current?.id;
    if (!rideId) return;
    try {
      await driverRideService.acceptCustomerFare(rideId);
      const refreshed = await driverRideService.getRideForDriver(rideId);
      setCurrentRide(mapBackendRideToUiRide(refreshed));
    } catch (error) {
      reportOperationalFailure('ride.driver.acceptOffer', error);
    }
  }, []);

  const riderAcceptWithFare = useCallback(async (amount: number) => {
    const rideId = currentRideRef.current?.id;
    if (!rideId || amount <= 0) return;
    try {
      await driverRideService.lockManualFare(rideId, amount);
      const refreshed = await driverRideService.getRideForDriver(rideId);
      setCurrentRide(mapBackendRideToUiRide(refreshed));
    } catch (error) {
      reportOperationalFailure('ride.driver.lockFare', error);
    }
  }, []);

  // Runs a driver state transition with a 409-tolerant refresh and a re-entrancy lock.
  const runDriverTransition = useCallback(async (action: (rideId: string) => Promise<void>) => {
    const rideId = currentRideRef.current?.id;
    if (!rideId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      await action(rideId);
      const refreshed = await driverRideService.getRideForDriver(rideId);
      setCurrentRide(mapBackendRideToUiRide(refreshed));
    } catch (err: any) {
      if (err?.response?.status === 409) {
        try {
          const refreshed = await driverRideService.getRideForDriver(rideId);
          setCurrentRide(mapBackendRideToUiRide(refreshed));
        } catch {}
      }
    } finally {
      transitionLockRef.current = false;
    }
  }, []);

  const markArrived = useCallback(() => {
    void runDriverTransition(id => driverRideService.markArrived(id));
  }, [runDriverTransition]);

  const startJourney = useCallback(() => {
    void runDriverTransition(id => driverRideService.startRide(id));
  }, [runDriverTransition]);

  const acceptRideRequest = useCallback(async () => {
    const request = pendingRequestRef.current;
    if (!request?.id) return;
    activeRoleRef.current = 'driver';
    try {
      await driverRideService.acceptRideRequest(request.id);
      const data = await driverRideService.getRideForDriver(request.id);
      setCurrentRide({
        ...mapBackendRideToUiRide(data),
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        suggestedFare: request.suggestedFare,
      });
      setPendingRequest(null);
    } catch (error) {
      reportOperationalFailure('ride.driver.accept', error);
    }
  }, []);

  const declineRideRequest = useCallback(async () => {
    const request = pendingRequestRef.current;
    if (!request?.id) return;
    try {
      await driverRideService.declineRideRequest(request.id);
    } catch {}
    setPendingRequest(null);
  }, []);

  // ── Completion ────────────────────────────────────────────────────────────────

  const clearCurrentRide = useCallback(() => {
    setCurrentRide(null);
  }, []);

  const completeRide = useCallback((
    source?: 'customer' | 'driver',
    _driverIdentity?: { driverId?: string; driverName?: string; vehicleType?: VehicleType },
  ) => {
    const role = source ?? activeRoleRef.current;
    // Customer side never calls the backend /complete (wrong role → 403); the
    // driver already completed it server-side and the customer just clears local.
    if (role !== 'driver') {
      setCurrentRide(null);
      setDriverLocation(null);
      return;
    }
    const rideId = currentRideRef.current?.id;
    if (!rideId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    driverRideService.completeRide(rideId)
      .then(() => {
        // Decrement the locally-tracked ride credit so the packages UI updates
        // immediately. The backend also deducts server-side (authoritative).
        void driverEntitlement?.deductCreditForCompletedRide(rideId);
        setCurrentRide(null);
      })
      .catch((err: any) => {
        if (err?.response?.status === 409) setCurrentRide(null);
        else reportOperationalFailure('ride.driver.complete', err);
      })
      .finally(() => { transitionLockRef.current = false; setDriverLocation(null); });
  }, [driverEntitlement]);

  // ── Misc ──────────────────────────────────────────────────────────────────────

  const sendWsLocationUpdate = useCallback((lat: number, lng: number) => {
    wsRef.current?.send({ type: 'location_update', lat, lng });
  }, []);

  const refreshCurrentRide = useCallback(async () => {
    const rideId = currentRideRef.current?.id;
    if (!rideId) return;
    try {
      const data = await rideService.getRide(rideId);
      const updated = mapBackendRideToUiRide(data);
      setCurrentRide(prev => {
        if (!prev) return prev;
        if (prev.status === 'completed' || prev.status === 'cancelled') return prev;
        return updated;
      });
    } catch {
      // Keep cached state; next poll retries.
    }
  }, []);

  const pauseDriverMatching = useCallback(() => setIsMatchingPaused(true), []);
  const resumeDriverMatching = useCallback(() => setIsMatchingPaused(false), []);

  const loadHistory = useCallback(async (limit = 20) => {
    try {
      const data = await rideService.listRides(limit, 0);
      const rides = Array.isArray(data?.rides) ? data.rides.map(mapBackendRideToUiRide) : [];
      setRideHistory(rides);
    } catch (error) {
      reportOperationalFailure('ride.history.load', error);
    }
  }, []);

  // Disconnect the socket when the provider unmounts.
  useEffect(() => () => { disconnectWS(); }, [disconnectWS]);

  const value = useMemo<RideContextType>(() => ({
    currentRide,
    rideHistory,
    driverLocation,
    pendingRequest,
    createRide,
    cancelledSearchDraft,
    restoreBookingOnHomeFocus,
    clearCancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
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
    riderAcceptWithFare,
    loadHistory,
    initDriverSession,
    initCustomerSession,
    sendWsLocationUpdate,
    clearCurrentRide,
    refreshCurrentRide,
  }), [
    acceptCustomerOffer,
    acceptDriverOffer,
    acceptRideRequest,
    cancelRide,
    cancelledSearchDraft,
    clearCancelledSearchDraft,
    clearCurrentRide,
    clearRestoreBookingOnHomeFocus,
    completeRide,
    counterOffer,
    createRide,
    currentRide,
    declineDriverOffer,
    declineRideRequest,
    driverLocation,
    initCustomerSession,
    initDriverSession,
    isMatchingPaused,
    loadHistory,
    markArrived,
    pauseDriverMatching,
    pendingRequest,
    refreshCurrentRide,
    restoreBookingOnHomeFocus,
    resumeDriverMatching,
    rideHistory,
    riderAcceptWithFare,
    sendDriverOffer,
    sendWsLocationUpdate,
    startJourney,
  ]);

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used within RideProvider');
  return ctx;
}
