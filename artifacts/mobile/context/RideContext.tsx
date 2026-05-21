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
  proposeFare: (amount: number, isFinal?: boolean) => void;
  respondToNegotiation: (accept: boolean) => void;
  acceptDriverOffer: () => void;
  declineDriverOffer: () => void;
  completeRide: () => void;
  acceptRideRequest: () => void;
  declineRideRequest: () => void;
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
    const dist = calcDistance(pickup, destination);
    const fare = calcFare(vehicleType, dist);

    const ride: Ride = {
      id: generateId(),
      customerId: 'local_user',
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

    // Simulate driver search (4-6 seconds)
    const delay = 4000 + Math.random() * 2000;
    setTimeout(() => {
      // Find nearest driver with matching vehicle type (or any driver)
      const matching = MOCK_DRIVERS.filter(d => d.vehicleType === vehicleType);
      const driver: MockDriver = matching.length > 0
        ? matching[Math.floor(Math.random() * matching.length)]
        : MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)];

      setDriverLocation(driver.location);
      setCurrentRide(prev => prev ? {
        ...prev,
        status: 'negotiating',
        driver,
        driverId: driver.id,
      } : null);
    }, delay);
  }, []);

  const cancelRide = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    setTimeout(() => setCurrentRide(null), 2000);
  }, []);

  const proposeFare = useCallback((amount: number, isFinal = false) => {
    const msg: NegotiationMessage = {
      id: generateId(),
      sender: 'customer',
      amount,
      timestamp: new Date().toISOString(),
      isFinal,
    };
    setCurrentRide(prev => {
      if (!prev) return null;
      const updated = { ...prev, negotiation: [...prev.negotiation, msg] };
      return updated;
    });

    // Driver responds after 2 seconds
    setTimeout(() => {
      setCurrentRide(prev => {
        if (!prev) return null;
        const rounds = prev.negotiation.filter(m => m.sender === 'driver').length;
        const driverIsFinal = rounds >= 2 || isFinal;

        // Driver counters with ~15% higher than customer offer or accepts
        const shouldAccept = amount >= prev.suggestedFare * 0.9 || (isFinal && Math.random() > 0.3);

        if (shouldAccept) {
          return {
            ...prev,
            status: 'confirmed',
            agreedFare: amount,
            negotiation: [...prev.negotiation, {
              id: generateId(),
              sender: 'driver',
              amount,
              timestamp: new Date().toISOString(),
              isFinal: true,
            }],
          };
        }

        const counter = Math.round((amount * 1.15) / 100) * 100;
        const driverMsg: NegotiationMessage = {
          id: generateId(),
          sender: 'driver',
          amount: Math.min(counter, prev.suggestedFare),
          timestamp: new Date().toISOString(),
          isFinal: driverIsFinal,
        };
        return { ...prev, negotiation: [...prev.negotiation, driverMsg] };
      });
    }, 2000);
  }, []);

  const respondToNegotiation = useCallback((accept: boolean) => {
    setCurrentRide(prev => {
      if (!prev) return null;
      if (accept) {
        const lastDriverMsg = [...prev.negotiation].reverse().find(m => m.sender === 'driver');
        return { ...prev, status: 'confirmed', agreedFare: lastDriverMsg?.amount };
      }
      return { ...prev, status: 'cancelled', completedAt: new Date().toISOString() };
    });
  }, []);

  const acceptDriverOffer = useCallback(() => {
    setCurrentRide(prev => {
      if (!prev) return null;
      const lastMsg = [...prev.negotiation].reverse().find(m => m.sender === 'driver');
      return { ...prev, status: 'confirmed', agreedFare: lastMsg?.amount };
    });
  }, []);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const startLiveTracking = useCallback(() => {
    // Simulate driver moving toward pickup then destination
    let step = 0;
    driverIntervalRef.current = setInterval(() => {
      step++;
      setDriverLocation(prev => {
        if (!prev) return null;
        const noise = () => (Math.random() - 0.5) * 0.002;
        return { latitude: prev.latitude + noise(), longitude: prev.longitude + noise() };
      });
      if (step === 8) {
        updateStatus('in_progress');
      }
    }, 2000);
  }, []);

  const completeRide = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => {
      if (!prev) return null;
      const completed = { ...prev, status: 'completed' as RideStatus, completedAt: new Date().toISOString() };
      // Save to history
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
    setCurrentRide({ ...pendingRequest, status: 'negotiating' });
    setPendingRequest(null);
  }, [pendingRequest]);

  const declineRideRequest = useCallback(() => {
    setPendingRequest(null);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const str = await AsyncStorage.getItem('@taravelis_history');
      if (str) setRideHistory(JSON.parse(str));
    } catch {
      // ignore
    }
  }, []);

  // Start live tracking once confirmed
  React.useEffect(() => {
    if (currentRide?.status === 'confirmed') {
      const timer = setTimeout(() => {
        updateStatus('arriving');
        startLiveTracking();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed']);

  return (
    <RideContext.Provider value={{
      currentRide,
      rideHistory,
      driverLocation,
      pendingRequest,
      createRide,
      cancelRide,
      proposeFare,
      respondToNegotiation,
      acceptDriverOffer,
      declineDriverOffer,
      completeRide,
      acceptRideRequest,
      declineRideRequest,
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
