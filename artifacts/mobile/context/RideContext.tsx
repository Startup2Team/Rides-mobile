import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Coords,
  MockDriver,
  MOCK_DRIVERS,
  NegotiationMessage,
  Ride,
  RideLocation,
  RideStatus,
  VEHICLE_BASE_FARE,
  VehicleType,
} from '@/types';

interface RideContextType {
  currentRide: Ride | null;
  rideHistory: Ride[];
  driverLocation: Coords | null;
  pendingRequest: Ride | null;
  createRide: (pickup: RideLocation, destination: RideLocation, vehicleType: VehicleType) => Promise<void>;
  cancelRide: () => void;
  counterOffer: (amount: number) => void;
  acceptDriverOffer: () => void;
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

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function calcDistance(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function calcFare(vehicleType: VehicleType, distanceKm: number): number {
  const base = VEHICLE_BASE_FARE[vehicleType];
  const perKm = vehicleType === 'moto' ? 200 : vehicleType === 'cab' ? 400 : vehicleType === 'hilux' ? 600 : 800;
  return Math.round((base + distanceKm * perKm) / 100) * 100;
}

function buildMockRideRequest(): Ride {
  const pickup: RideLocation = {
    address: 'Kimironko Market',
    latitude: -1.9365,
    longitude: 30.1011,
    locationType: 'precise',
  };
  const destination: RideLocation = {
    address: 'Kigali City Tower',
    latitude: -1.9438,
    longitude: 30.0616,
    locationType: 'precise',
  };
  const distance = calcDistance(pickup, destination);

  return {
    id: generateId(),
    customerId: 'mock_customer',
    customerName: 'Amina K.',
    customerPhone: '+250788000000',
    vehicleType: 'moto',
    pickup,
    destination,
    status: 'searching',
    distance: parseFloat(distance.toFixed(2)),
    duration: Math.round(distance * 3 + 5),
    suggestedFare: calcFare('moto', distance),
    negotiation: [],
    createdAt: new Date().toISOString(),
  };
}

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Ride | null>(null);
  const driverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = (status: RideStatus, extra?: Partial<Ride>) => {
    setCurrentRide(prev => prev ? { ...prev, status, ...extra } : null);
  };

  const createRide = useCallback(async (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
  ) => {
    if (currentRide && ['negotiating', 'confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)) {
      return;
    }

    const dist = calcDistance(pickup, destination);
    const fare = calcFare(vehicleType, dist);

      const ride: Ride = {
      id: generateId(),
      customerId: 'local_user',
      customerName: 'Customer',
      customerPhone: '',
      vehicleType,
      pickup,
      destination,
      status: 'searching',
      distance: parseFloat(dist.toFixed(2)),
      duration: Math.round(dist * 3 + 5),
      suggestedFare: fare,
      negotiation: [],
      createdAt: new Date().toISOString(),
    };

    setCurrentRide(ride);

    const delay = 4000 + Math.random() * 2000;
    setTimeout(() => {
      const matching = MOCK_DRIVERS.filter(d => d.vehicleType === vehicleType);
      const driver: MockDriver = matching.length > 0
        ? matching[Math.floor(Math.random() * matching.length)]
        : MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)];

      setDriverLocation(driver.location);

      const isGeneric = pickup.locationType === 'generic' || destination.locationType === 'generic';

      const initialMessages: NegotiationMessage[] = [];
      if (isGeneric) {
        const destLabel = destination.address || destination.locationType === 'generic' ? (destination.address ?? 'Unknown location') : (pickup.address ?? 'Unknown location');
        initialMessages.push({
          id: generateId(),
          sender: 'system',
          type: 'text',
          text: `My destination is ${destLabel}. Please let me know your price.`,
          timestamp: new Date().toISOString(),
        });
      }

      setCurrentRide(prev => prev ? {
        ...prev,
        status: 'negotiating',
        driver,
        driverId: driver.id,
        negotiation: initialMessages,
      } : null);

      setTimeout(() => {
        setCurrentRide(prev => {
          if (!prev || prev.status !== 'negotiating') return prev;
          const driverOffer = Math.round((calcFare(vehicleType, dist) * (1 + (Math.random() * 0.3))) / 100) * 100;
          const driverMsg: NegotiationMessage = {
            id: generateId(),
            sender: 'driver',
            type: 'offer',
            amount: driverOffer,
            timestamp: new Date().toISOString(),
          };
          return { ...prev, negotiation: [...prev.negotiation, driverMsg] };
        });
      }, 2500);
    }, delay);
  }, [currentRide]);

  const cancelRide = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    setTimeout(() => setCurrentRide(null), 2000);
  }, []);

  const counterOffer = useCallback((amount: number) => {
    setCurrentRide(prev => {
      if (!prev) return null;
      
      // Strictly enforce the 3-message limit per Section 2.3/3.2
      const customerMessages = prev.negotiation.filter(
        m => m.sender === 'customer' && m.type === 'offer'
      );
      if (customerMessages.length >= 3) return prev;

      const msg: NegotiationMessage = {
        id: generateId(),
        sender: 'customer',
        type: 'offer',
        amount,
        timestamp: new Date().toISOString(),
      };
      return { ...prev, negotiation: [...prev.negotiation, msg] };
    });

    setTimeout(() => {
      setCurrentRide(prev => {
        if (!prev || prev.status !== 'negotiating') return prev;
        
        // Check driver message limit
        const driverMessages = prev.negotiation.filter(
          m => m.sender === 'driver' && m.type === 'offer'
        );
        if (driverMessages.length >= 3) return prev;

        const shouldAccept = amount >= prev.suggestedFare * 0.85 || Math.random() > 0.6;

        if (shouldAccept) {
          const agreedMsg: NegotiationMessage = {
            id: generateId(),
            sender: 'driver',
            type: 'offer',
            amount,
            timestamp: new Date().toISOString(),
            isFinal: true,
          };
          return {
            ...prev,
            status: 'confirmed',
            agreedFare: amount,
            negotiation: [...prev.negotiation, agreedMsg],
          };
        }

        const counter = Math.round((amount * 1.12) / 100) * 100;
        const driverMsg: NegotiationMessage = {
          id: generateId(),
          sender: 'driver',
          type: 'offer',
          amount: Math.min(counter, Math.round(prev.suggestedFare * 1.1 / 100) * 100),
          timestamp: new Date().toISOString(),
        };
        return { ...prev, negotiation: [...prev.negotiation, driverMsg] };
      });
    }, 2000);
  }, []);

  const acceptDriverOffer = useCallback(() => {
    setCurrentRide(prev => {
      if (!prev) return null;
      const lastDriverMsg = [...prev.negotiation].reverse().find(m => m.sender === 'driver' && m.type === 'offer');
      if (!lastDriverMsg?.amount) return prev;
      return { ...prev, status: 'confirmed', agreedFare: lastDriverMsg.amount };
    });
  }, []);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const startLiveTracking = useCallback(() => {
    let step = 0;
    driverIntervalRef.current = setInterval(() => {
      step++;
      setDriverLocation(prev => {
        if (!prev) return null;
        const noise = () => (Math.random() - 0.5) * 0.002;
        return { latitude: prev.latitude + noise(), longitude: prev.longitude + noise() };
      });
      if (step === 10) {
        const now = new Date().toISOString();
        setCurrentRide(prev => prev ? { ...prev, status: 'arrived', arrivedAt: now, waitStartedAt: now } : null);
        if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
      }
    }, 2000);
  }, []);

  const markArrived = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => {
      const now = new Date().toISOString();
      return prev ? { ...prev, status: 'arrived', arrivedAt: now, waitStartedAt: now } : null;
    });
  }, []);

  const startJourney = useCallback(() => {
    setCurrentRide(prev => {
      if (!prev || prev.status !== 'arrived') return prev;
      return { ...prev, status: 'in_progress' };
    });
    driverIntervalRef.current = setInterval(() => {
      setDriverLocation(prev => {
        if (!prev) return null;
        const noise = () => (Math.random() - 0.5) * 0.001;
        return { latitude: prev.latitude + noise(), longitude: prev.longitude + noise() };
      });
    }, 3000);
  }, []);

  const completeRide = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => {
      if (!prev || !driverLocation) return null;
      
      // Section 7.2: Ensure driver is within 200m of destination
      const distToDest = calcDistance(driverLocation, prev.destination);
      if (distToDest > 0.2) { // 0.2 km = 200 meters
        // In a real app, we might trigger an alert here via a separate state
        return prev;
      }

      const completed = { ...prev, status: 'completed' as RideStatus, completedAt: new Date().toISOString() };
      setRideHistory(hist => [completed, ...hist]);
      AsyncStorage.getItem('@taravelis_history').then(str => {
        const hist: Ride[] = str ? JSON.parse(str) : [];
        AsyncStorage.setItem('@taravelis_history', JSON.stringify([completed, ...hist].slice(0, 50)));
      });
      return null;
    });
    setDriverLocation(null);
  }, []);

  const acceptRideRequest = useCallback(() => {
    if (!pendingRequest) return;
    const request = pendingRequest;
    const isGeneric = request.pickup.locationType === 'generic' || request.destination.locationType === 'generic';
    const initialMessages: NegotiationMessage[] = isGeneric
      ? [{
          id: generateId(),
          sender: 'system',
          type: 'text',
          text: `My destination is ${request.destination.address ?? 'Unknown location'}. Please let me know your price.`,
          timestamp: new Date().toISOString(),
        }]
      : [];
    setCurrentRide({ ...request, status: 'negotiating', negotiation: initialMessages });
    setPendingRequest(null);
  }, [pendingRequest]);

  const declineRideRequest = useCallback(() => {
    setPendingRequest(null);
  }, []);

  const simulateIncomingRideRequest = useCallback(() => {
    setPendingRequest(prev => prev ?? buildMockRideRequest());
  }, []);

  const riderAcceptWithFare = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentRide(prev => {
      if (!prev) return null;
      return { ...prev, status: 'confirmed', agreedFare: amount };
    });
  }, []);

  React.useEffect(() => {
    if (currentRide?.status === 'confirmed') {
      const timer = setTimeout(() => {
        updateStatus('arriving');
        startLiveTracking();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed']);

  const loadHistory = useCallback(async () => {
    try {
      const str = await AsyncStorage.getItem('@taravelis_history');
      if (str) setRideHistory(JSON.parse(str));
    } catch {
    }
  }, []);

  return (
    <RideContext.Provider value={{
      currentRide,
      rideHistory,
      driverLocation,
      pendingRequest,
      createRide,
      cancelRide,
      counterOffer,
      acceptDriverOffer,
      declineDriverOffer,
      completeRide,
      markArrived,
      startJourney,
      acceptRideRequest,
      declineRideRequest,
      simulateIncomingRideRequest,
      riderAcceptWithFare,
      loadHistory,
    }}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used within RideProvider');
  return ctx;
}
