import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  BookingFormDraft,
  Coords,
  Ride,
  RideLocation,
  RideStatus,
  VehicleType,
} from '@/types';
import { buildDriverWithUploadedPhoto } from '@/utils/driverProfileImage';
import { RideContextType } from './rideTypes';
import { calcDistance, calcFare } from './rideFare';
import {
  buildInitialDriverOffer,
  buildInitialNegotiationMessages,
  buildMockRideRequest,
  getDriverMatchDelay,
  pickMockDriver,
} from './rideMatching';
import {
  acceptLatestCustomerOffer,
  acceptLatestDriverOffer,
  acceptRideWithFare,
  addCustomerCounterOffer,
  addDriverOffer,
  respondToCustomerCounterOffer,
} from './rideNegotiation';
import { appendRideHistory, loadRideHistory } from './ridePersistence';
import { addTrackingNoise, markRideArrived, startRideJourney } from './rideTracking';
import { cloneBookingDraft, generateRideId } from './rideUtils';
import {
  ARRIVING_TRACKING_INTERVAL_MS,
  ARRIVING_TRACKING_NOISE,
  ARRIVING_TRACKING_STEPS,
  CANCELLED_RIDE_CLEAR_DELAY_MS,
  CONFIRMED_RIDE_START_DELAY_MS,
  DRIVER_MATCH_RESUME_DELAY_MS,
  DRIVER_OFFER_DELAY_MS,
  JOURNEY_TRACKING_INTERVAL_MS,
  JOURNEY_TRACKING_NOISE,
  NEGOTIATION_RESPONSE_DELAY_MS,
} from './rideConstants';

const RideContext = createContext<RideContextType | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [cancelledSearchDraft, setCancelledSearchDraft] = useState<BookingFormDraft | null>(null);
  const [restoreBookingOnHomeFocus, setRestoreBookingOnHomeFocus] = useState(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [pendingRequest, setPendingRequest] = useState<Ride | null>(null);
  const [isMatchingPaused, setIsMatchingPaused] = useState(false);
  const driverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchDriverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverOfferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMatchingPausedRef = useRef(false);

  const clearSearchTimers = useCallback(() => {
    if (matchDriverTimeoutRef.current) clearTimeout(matchDriverTimeoutRef.current);
    if (driverOfferTimeoutRef.current) clearTimeout(driverOfferTimeoutRef.current);
    matchDriverTimeoutRef.current = null;
    driverOfferTimeoutRef.current = null;
  }, []);

  const assignMatchedDriver = useCallback((
    vehicleType: VehicleType,
    pickup: RideLocation,
    destination: RideLocation,
    dist: number,
  ) => {
    if (isMatchingPausedRef.current) return;

    const picked = pickMockDriver(vehicleType);
    const initialMessages = buildInitialNegotiationMessages(pickup, destination);

    void buildDriverWithUploadedPhoto(picked).then(driver => {
      if (isMatchingPausedRef.current) return;

      setDriverLocation(driver.location);

      setCancelledSearchDraft(null);

      setCurrentRide(prev => {
        if (!prev || prev.status !== 'searching' || isMatchingPausedRef.current) return prev;
        return {
          ...prev,
          status: 'negotiating',
          driver,
          driverId: driver.id,
          negotiation: initialMessages,
        };
      });

      driverOfferTimeoutRef.current = setTimeout(() => {
        driverOfferTimeoutRef.current = null;
        if (isMatchingPausedRef.current) return;
        setCurrentRide(prev => {
          if (!prev || prev.status !== 'negotiating') return prev;
          const driverMsg = buildInitialDriverOffer(vehicleType, dist);
          return { ...prev, negotiation: [...prev.negotiation, driverMsg] };
        });
      }, DRIVER_OFFER_DELAY_MS);
    });
  }, []);

  const scheduleDriverMatch = useCallback((
    vehicleType: VehicleType,
    pickup: RideLocation,
    destination: RideLocation,
    dist: number,
    delayMs?: number,
  ) => {
    const delay = delayMs ?? getDriverMatchDelay();
    matchDriverTimeoutRef.current = setTimeout(() => {
      matchDriverTimeoutRef.current = null;
      assignMatchedDriver(vehicleType, pickup, destination, dist);
    }, delay);
  }, [assignMatchedDriver]);

  const pauseDriverMatching = useCallback(() => {
    isMatchingPausedRef.current = true;
    setIsMatchingPaused(true);
    clearSearchTimers();
  }, [clearSearchTimers]);

  const resumeDriverMatching = useCallback(() => {
    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    setCurrentRide(prev => {
      if (!prev || prev.status !== 'searching') return prev;
      scheduleDriverMatch(
        prev.vehicleType,
        prev.pickup,
        prev.destination,
        prev.distance,
        DRIVER_MATCH_RESUME_DELAY_MS,
      );
      return prev;
    });
  }, [scheduleDriverMatch]);

  const updateStatus = (status: RideStatus, extra?: Partial<Ride>) => {
    setCurrentRide(prev => prev ? { ...prev, status, ...extra } : null);
  };

  const clearCancelledSearchDraft = useCallback(() => {
    setCancelledSearchDraft(null);
    setRestoreBookingOnHomeFocus(false);
  }, []);

  const clearRestoreBookingOnHomeFocus = useCallback(() => {
    setRestoreBookingOnHomeFocus(false);
  }, []);

  const createRide = useCallback(async (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
    destText = '',
  ) => {
    if (currentRide && ['negotiating', 'confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)) {
      return;
    }

    const dist = calcDistance(pickup, destination);
    const fare = calcFare(vehicleType, dist);

      const ride: Ride = {
      id: generateRideId(),
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

    const displayDestText = destText.trim() || destination.address?.trim() || '';
    setCancelledSearchDraft(cloneBookingDraft(pickup, destination, vehicleType, displayDestText));

    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    clearSearchTimers();
    setCurrentRide(ride);
    scheduleDriverMatch(vehicleType, pickup, destination, parseFloat(dist.toFixed(2)));
  }, [clearSearchTimers, currentRide, scheduleDriverMatch]);

  const cancelRide = useCallback(() => {
    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    clearSearchTimers();
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setDriverLocation(null);
    setRestoreBookingOnHomeFocus(true);
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    setTimeout(() => setCurrentRide(null), CANCELLED_RIDE_CLEAR_DELAY_MS);
  }, [clearSearchTimers]);

  const counterOffer = useCallback((amount: number) => {
    setCurrentRide(prev => addCustomerCounterOffer(prev, amount));

    setTimeout(() => {
      setCurrentRide(prev => respondToCustomerCounterOffer(prev, amount));
    }, NEGOTIATION_RESPONSE_DELAY_MS);
  }, []);

  const acceptDriverOffer = useCallback(() => {
    setCurrentRide(acceptLatestDriverOffer);
  }, []);

  const sendDriverOffer = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentRide(prev => addDriverOffer(prev, amount));
  }, []);

  const acceptCustomerOffer = useCallback(() => {
    setCurrentRide(acceptLatestCustomerOffer);
  }, []);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const startLiveTracking = useCallback(() => {
    let step = 0;
    driverIntervalRef.current = setInterval(() => {
      step++;
      setDriverLocation(prev => addTrackingNoise(prev, ARRIVING_TRACKING_NOISE));
      if (step === ARRIVING_TRACKING_STEPS) {
        setCurrentRide(markRideArrived);
        if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
      }
    }, ARRIVING_TRACKING_INTERVAL_MS);
  }, []);

  const markArrived = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(markRideArrived);
  }, []);

  const startJourney = useCallback(() => {
    setCurrentRide(startRideJourney);
    driverIntervalRef.current = setInterval(() => {
      setDriverLocation(prev => addTrackingNoise(prev, JOURNEY_TRACKING_NOISE));
    }, JOURNEY_TRACKING_INTERVAL_MS);
  }, []);

  const completeRide = useCallback(() => {
    if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    setCurrentRide(prev => {
      if (!prev) return null;
      const completed = { ...prev, status: 'completed' as RideStatus, completedAt: new Date().toISOString() };
      setRideHistory(hist => [completed, ...hist]);
      void appendRideHistory(completed);
      return null;
    });
    setDriverLocation(null);
  }, []);

  const acceptRideRequest = useCallback(() => {
    if (!pendingRequest) return;
    const request = pendingRequest;
    const initialMessages = buildInitialNegotiationMessages(request.pickup, request.destination);
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
    setCurrentRide(prev => acceptRideWithFare(prev, amount));
  }, []);

  React.useEffect(() => {
    if (currentRide?.status === 'confirmed') {
      const timer = setTimeout(() => {
        updateStatus('arriving');
        startLiveTracking();
      }, CONFIRMED_RIDE_START_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed']);

  const loadHistory = useCallback(async () => {
    try {
      const history = await loadRideHistory();
      if (history) setRideHistory(history);
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
