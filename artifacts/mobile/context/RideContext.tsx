import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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
  simulateIncomingRideRequest: () => void;
  riderAcceptWithFare: (amount: number) => void;
  loadHistory: () => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

const toRideStatus = (status?: string): Ride['status'] => {
  switch (status) {
    case 'SEARCHING':
      return 'searching';
    case 'MATCHED':
      return 'driver_assigned';
    case 'NEGOTIATING':
      return 'negotiating';
    case 'CONFIRMED':
      return 'confirmed';
    case 'DRIVER_EN_ROUTE':
      return 'arriving';
    case 'DRIVER_ARRIVED':
      return 'arrived';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'idle';
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

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Ride | null>(null);
  const [isMatchingPaused, setIsMatchingPaused] = useState(false);
  const wsRef = useRef<RideWebSocket | null>(null);

  const disconnectWS = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
  }, []);

  const connectCustomerWS = useCallback(async (rideId: string) => {
    disconnectWS();
    const ws = new RideWebSocket();
    wsRef.current = ws;
    await ws.connect('/ws/customer', { ride_id: rideId });

    ws.on('driver_matched', payload => {
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
      .on('driver_arrived', () => {
        setCurrentRide(prev => prev ? { ...prev, status: 'arrived', arrivedAt: new Date().toISOString(), waitStartedAt: new Date().toISOString() } : null);
      })
      .on('driver_location', payload => {
        if (typeof payload?.lat === 'number' && typeof payload?.lng === 'number') {
          setDriverLocation({ latitude: payload.lat, longitude: payload.lng });
        }
      })
      .on('ride_completed', payload => {
        setCurrentRide(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString(), agreedFare: Number(payload?.final_fare ?? prev.agreedFare ?? 0) } : null);
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
    ws.on('ride_request', payload => {
      setPendingRequest(mapDriverRequestToRide(payload));
    }).on('ride_cancelled', payload => {
      if (payload?.ride_id && currentRide?.id === payload.ride_id) {
        setCurrentRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
    }).on('negotiation_message', payload => {
      // Backend sends this when the CUSTOMER proposes a counter-offer.
      // The driver's own offers are added optimistically by sendDriverOffer, so
      // we only add incoming messages where proposed_by === 'CUSTOMER'.
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
    }).on('ride_confirmed', payload => {
      // Fired when the CUSTOMER accepts the driver's offer. The driver's own
      // accept (acceptCustomerOffer) updates state via HTTP refresh, so this
      // handler is primarily for the case where the customer accepts first.
      const agreedFare = Number(payload?.agreed_fare ?? 0);
      setCurrentRide(prev => prev ? {
        ...prev,
        status: 'confirmed',
        ...(agreedFare > 0 ? { agreedFare } : {}),
      } : null);
    });
  }, [currentRide?.id]);

  const createRide = useCallback(async (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
  ) => {
    if (currentRide && ['searching', 'driver_assigned', 'negotiating', 'confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)) {
      return;
    }
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
    // Optimistic update — add the customer's offer to the local negotiation list
    // immediately (same pattern as sendDriverOffer). This flips lastMsg.sender to
    // 'customer', hiding the input dock right away so the UI correctly shows a
    // "waiting for driver" state without any loading spinner.
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
    // Set status locally immediately so navigation fires without waiting for the
    // socket echo. The ride_confirmed socket event will arrive shortly after and
    // update agreed_fare; this local update is belt-and-suspenders for cases
    // where the socket delivery is slightly delayed.
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
  }, [currentRide?.id]);

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

  const simulateIncomingRideRequest = useCallback(() => {
    connectDriverWS().catch(() => {});
    // Resume any in-progress ride from before the app was backgrounded/restarted.
    // Returns null when idle — don't update state in that case.
    driverRideService.getActiveRideForDriver()
      .then(data => { if (data) setCurrentRide(mapBackendRideToUiRide(data)); })
      .catch(() => {});
  }, [connectDriverWS]);

  const riderAcceptWithFare = useCallback(async (amount: number) => {
    if (!currentRide?.id) return;
    await driverRideService.lockManualFare(currentRide.id, amount);
    const refreshed = await driverRideService.getRideForDriver(currentRide.id);
    setCurrentRide(mapBackendRideToUiRide(refreshed));
  }, [currentRide?.id]);

  const pauseDriverMatching = useCallback(() => setIsMatchingPaused(true), []);
  const resumeDriverMatching = useCallback(() => setIsMatchingPaused(false), []);

  const loadHistory = useCallback(async () => {
    const data = await rideService.listRides(20, 0);
    const rides = Array.isArray(data?.rides) ? data.rides.map(mapBackendRideToUiRide) : [];
    setRideHistory(rides);
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
      simulateIncomingRideRequest,
      riderAcceptWithFare,
      loadHistory,
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
      simulateIncomingRideRequest,
      startJourney,
      currentRide,
      isMatchingPaused,
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
