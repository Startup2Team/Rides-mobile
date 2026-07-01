import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookingFormDraft,
  Coords,
  KIGALI_CENTER,
  Ride,
  RideLocation,
  RideStatus,
  VehicleType,
} from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { buildDriverWithUploadedPhoto } from '@/utils/driverProfileImage';
import { RideContextType } from './rideTypes';
import { resolveCapabilities, type CapabilitySnapshot } from '@/capabilities';
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
  addCustomerAutoReply,
  addDriverOffer,
  respondToCustomerCounterOffer,
} from './rideNegotiation';
import { appendRideHistory, loadRideHistory } from './ridePersistence';
import { addTrackingNoise, markRideArrived, startRideJourney } from './rideTracking';
import { createRideTimerManager, type RideSessionToken } from './rideTimerManager';
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
import { reportOperationalFailure } from '@/observability/monitoring';
import { useOptionalDriverEntitlement } from '@/context/DriverEntitlementContext';
import { useOptionalAuth } from '@/context/AuthContext';
import { getEligibleOnlineSessionVehicle } from './rideSession';
import {
  shadowWireAcceptRideCommand,
  shadowWireCancelRideCommand,
  shadowWireDeclineRideCommand,
  shadowWireRequestRideCommand,
  shadowWireStartRideCommand,
} from '@/domains/ride/commandPipeline';
import { createRideCorrelationId } from '@/domains/ride/idempotency';
import { createStartRideCommand } from '@/domains/ride/commandCreators';
import { rideTransactionBoundary } from '@/domains/ride/transactions';
import type { ActiveRideReadModel, RideParticipant, RidePhase as RideProjectionPhase, RideStatus as RideProjectionStatus } from '@/domains/ride/readModels';

const RideContext = createContext<RideContextType | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const driverEntitlement = useOptionalDriverEntitlement();
  const auth = useOptionalAuth();
  const [pickup, setPickup] = useState<RideLocation>({
    ...KIGALI_CENTER,
    address: '',
    locationType: 'generic',
  });
  const [destination, setDestination] = useState<RideLocation | null>(null);
  const [destText, setDestText] = useState('');
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
  const currentRideRef = useRef(currentRide);
  const pendingRequestRef = useRef(pendingRequest);
  const timerManagerRef = useRef(createRideTimerManager());
  const timers = timerManagerRef.current;
  currentRideRef.current = currentRide;
  pendingRequestRef.current = pendingRequest;
  const rideCommandCapabilitySnapshot = useMemo<CapabilitySnapshot>(() => ({
    ...resolveCapabilities({
      user: auth?.user ?? null,
      driverProfile: auth?.driverProfile ?? null,
      driverEntitlement: driverEntitlement?.entitlement ?? null,
      vehicles: auth?.driverProfile?.vehicles ?? [],
      mode: auth?.user?.mode ?? null,
    }),
    mode: auth?.user?.mode ?? null,
  }), [auth?.driverProfile, auth?.user, driverEntitlement?.entitlement]);

  const clearSearchTimers = useCallback(() => {
    timers.clearTimeout(matchDriverTimeoutRef.current);
    timers.clearTimeout(driverOfferTimeoutRef.current);
    matchDriverTimeoutRef.current = null;
    driverOfferTimeoutRef.current = null;
  }, [timers]);

  const assignMatchedDriver = useCallback((
    vehicleType: VehicleType,
    pickup: RideLocation,
    destination: RideLocation,
    dist: number,
    session: RideSessionToken,
  ) => {
    if (!timers.isActive(session) || isMatchingPausedRef.current) return;

    const picked = pickMockDriver(vehicleType);
    const initialMessages = buildInitialNegotiationMessages(pickup, destination);

    void buildDriverWithUploadedPhoto(picked).then(driver => {
      if (!timers.isActive(session) || isMatchingPausedRef.current) return;

      setDriverLocation(driver.location);

      setCancelledSearchDraft(null);

      setCurrentRide(prev => {
        if (!prev || prev.status !== 'searching' || isMatchingPausedRef.current) return prev;
        return {
          ...prev,
          status: 'negotiating',
          driver,
          driverId: driver.id,
          matchedVehicleId: driver.id,
          matchedVehicleType: driver.vehicleType,
          negotiation: initialMessages,
        };
      });

      driverOfferTimeoutRef.current = timers.scheduleTimeout(() => {
        driverOfferTimeoutRef.current = null;
        if (isMatchingPausedRef.current) return;
        setCurrentRide(prev => {
          if (!prev || prev.status !== 'negotiating') return prev;
          const driverMsg = buildInitialDriverOffer(vehicleType, dist);
          return { ...prev, negotiation: [...prev.negotiation, driverMsg] };
        });
      }, DRIVER_OFFER_DELAY_MS, session);
    });
  }, [timers]);

  const scheduleDriverMatch = useCallback((
    vehicleType: VehicleType,
    pickup: RideLocation,
    destination: RideLocation,
    dist: number,
    delayMs?: number,
  ) => {
    const delay = delayMs ?? getDriverMatchDelay();
    const session = timers.currentSession();
    matchDriverTimeoutRef.current = timers.scheduleTimeout(() => {
      matchDriverTimeoutRef.current = null;
      assignMatchedDriver(vehicleType, pickup, destination, dist, session);
    }, delay, session);
  }, [assignMatchedDriver, timers]);

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

  function buildTransactionParticipant(
    userId: string | undefined,
    role: RideParticipant['role'],
    displayName?: string | null,
  ): RideParticipant {
    return {
      userId: userId ?? 'local_user',
      role,
      ...(displayName ? { displayName } : {}),
    };
  }

  function toTransactionRideStatus(status: RideStatus): RideProjectionStatus {
    switch (status) {
      case 'arrived':
        return 'driver_arrived';
      case 'in_progress':
        return 'started';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      case 'confirmed':
        return 'accepted';
      case 'arriving':
        return 'driver_en_route';
      case 'driver_assigned':
        return 'matching';
      case 'negotiating':
        return 'offered';
      case 'searching':
      default:
        return 'matching';
    }
  }

  function toTransactionRidePhase(status: RideStatus): RideProjectionPhase {
    switch (status) {
      case 'in_progress':
        return 'active';
      case 'completed':
      case 'cancelled':
        return 'closed';
      case 'arrived':
      case 'confirmed':
        return 'accepted';
      case 'arriving':
        return 'accepted';
      case 'searching':
      case 'driver_assigned':
      case 'negotiating':
      default:
        return 'matching';
    }
  }

  function buildStartRideTransactionRide(ride: Ride): ActiveRideReadModel {
    return {
      rideId: ride.id,
      status: toTransactionRideStatus(ride.status),
      phase: toTransactionRidePhase(ride.status),
      customer: buildTransactionParticipant(ride.customerId, 'customer', ride.customerName ?? 'Customer'),
      driver: ride.driverId || ride.driverName
        ? buildTransactionParticipant(ride.driverId ?? ride.driver?.id ?? 'local_user', 'driver', ride.driverName ?? ride.driver?.name ?? null)
        : null,
      pickup: {
        address: ride.pickup.address ?? '',
        latitude: ride.pickup.latitude,
        longitude: ride.pickup.longitude,
        capturedAt: ride.createdAt,
      },
      destination: {
        address: ride.destination.address ?? '',
        latitude: ride.destination.latitude,
        longitude: ride.destination.longitude,
        capturedAt: ride.createdAt,
      },
      fare: typeof ride.agreedFare === 'number'
        ? {
            amount: ride.agreedFare,
            currency: 'RWF',
            source: 'negotiated',
            finalizedAt: ride.status === 'completed' ? ride.completedAt ?? ride.createdAt : null,
          }
        : {
            amount: ride.suggestedFare,
            currency: 'RWF',
            source: 'estimate',
            finalizedAt: null,
          },
      updatedAt: ride.completedAt ?? ride.arrivedAt ?? ride.createdAt,
      sequenceNumber: 1,
      projection: {
        appliedEventIds: [],
      },
    };
  }

  function recordStartRideTransactionTelemetry(
    result: ReturnType<typeof rideTransactionBoundary.evaluate>,
    command: ReturnType<typeof createStartRideCommand>,
  ) {
    observability.metrics.counter('ride.start_transaction.preview', 1, {
      rideId: command.payload.rideId,
      commandId: command.commandId,
    });
    observability.logger.info('RideStartTransactionPreview', {
      rideId: command.payload.rideId,
      commandId: command.commandId,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      commandType: result.commandType,
      status: result.state,
    });

    if (result.accepted) {
      observability.metrics.counter('ride.start_transaction.accepted', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.info('RideStartTransactionAccepted', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
      return;
    }

    observability.metrics.counter('ride.start_transaction.rejected', 1, {
      rideId: command.payload.rideId,
    });
    observability.logger.warn('RideStartTransactionRejected', {
      rideId: command.payload.rideId,
      commandId: command.commandId,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      reason: result.reason,
    });

    if (result.orderingViolation) {
      observability.metrics.counter('ride.start_transaction.ordering_violation', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideStartTransactionOrderingViolation', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
    }

    if (result.duplicate) {
      observability.metrics.counter('ride.start_transaction.duplicate_detected', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideStartTransactionDuplicateDetected', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
    }

    if (result.reason === 'capability-denied') {
      observability.metrics.counter('ride.start_transaction.capability_denied', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideStartTransactionCapabilityDenied', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
    }
  }

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
    if (
      currentRideRef.current &&
      ['negotiating', 'confirmed', 'arriving', 'arrived', 'in_progress'].includes(
        currentRideRef.current.status,
      )
    ) {
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
      requestedVehicleType: vehicleType,
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
    try {
      shadowWireRequestRideCommand({
        rideId: ride.id,
        pickup,
        destination,
        vehicleType,
        actorId: auth?.user?.id ?? 'local_user',
        actorRole: 'customer',
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
    } catch (error) {
      reportOperationalFailure('ride.shadow.request', error, { rideId: ride.id });
    }
    setCancelledSearchDraft(cloneBookingDraft(pickup, destination, vehicleType, displayDestText));

    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    timers.startSession();
    clearSearchTimers();
    setCurrentRide(ride);
    scheduleDriverMatch(vehicleType, pickup, destination, parseFloat(dist.toFixed(2)));
  }, [auth?.user?.id, clearSearchTimers, rideCommandCapabilitySnapshot, scheduleDriverMatch, timers]);

  const cancelRide = useCallback(() => {
    const session = timers.endSession();
    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    clearSearchTimers();
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    setDriverLocation(null);
    setRestoreBookingOnHomeFocus(true);
    const currentRideSnapshot = currentRideRef.current;
    try {
      if (currentRideSnapshot) {
        const reason = currentRideSnapshot.status === 'searching' || currentRideSnapshot.status === 'driver_assigned' || currentRideSnapshot.status === 'negotiating'
          ? 'customer_before_acceptance'
          : 'customer_after_acceptance';
        shadowWireCancelRideCommand({
          rideId: currentRideSnapshot.id,
          reason,
          note: null,
          actorId: auth?.user?.id ?? currentRideSnapshot.customerId ?? 'local_user',
          actorRole: auth?.user?.mode === 'driver' ? 'driver' : 'customer',
          capabilitySnapshot: rideCommandCapabilitySnapshot,
        });
      }
    } catch (error) {
      reportOperationalFailure('ride.shadow.cancel', error, {
        rideId: currentRideSnapshot?.id ?? 'unknown',
      });
    }
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    timers.scheduleTimeout(() => {
      setCurrentRide(prev => prev?.status === 'cancelled' ? null : prev);
    }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
  }, [auth?.user?.id, auth?.user?.mode, clearSearchTimers, rideCommandCapabilitySnapshot, timers]);

  const counterOffer = useCallback((amount: number) => {
    setCurrentRide(prev => addCustomerCounterOffer(prev, amount));

    timers.scheduleTimeout(() => {
      setCurrentRide(prev => respondToCustomerCounterOffer(prev, amount));
    }, NEGOTIATION_RESPONSE_DELAY_MS);
  }, [timers]);

  const acceptDriverOffer = useCallback(() => {
    setCurrentRide(acceptLatestDriverOffer);
  }, []);

  const sendDriverOffer = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentRide(prev => addDriverOffer(prev, amount));
    timers.scheduleTimeout(() => {
      setCurrentRide(prev => addCustomerAutoReply(prev, amount));
    }, NEGOTIATION_RESPONSE_DELAY_MS);
  }, [timers]);

  const acceptCustomerOffer = useCallback(() => {
    setCurrentRide(acceptLatestCustomerOffer);
  }, []);

  const declineDriverOffer = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const startLiveTracking = useCallback(() => {
    let step = 0;
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = timers.scheduleInterval(() => {
      step++;
      setDriverLocation(prev => addTrackingNoise(prev, ARRIVING_TRACKING_NOISE));
      if (step === ARRIVING_TRACKING_STEPS) {
        timers.clearInterval(driverIntervalRef.current);
        driverIntervalRef.current = null;
      }
    }, ARRIVING_TRACKING_INTERVAL_MS);
  }, [timers]);

  const markArrived = useCallback(() => {
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    setCurrentRide(markRideArrived);
  }, [timers]);

  const startJourney = useCallback(() => {
    const currentRideSnapshot = currentRideRef.current;
    const startedAt = new Date().toISOString();
    setCurrentRide(startRideJourney);
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = timers.scheduleInterval(() => {
      setDriverLocation(prev => addTrackingNoise(prev, JOURNEY_TRACKING_NOISE));
    }, JOURNEY_TRACKING_INTERVAL_MS);
    if (!currentRideSnapshot) return;
    const actorRole = auth?.user?.mode === 'driver' && rideCommandCapabilitySnapshot.state.isApprovedDriver
      ? 'driver'
      : 'system';
    try {
      const command = createStartRideCommand({
        rideId: currentRideSnapshot.id,
        startedAt,
        location: null,
      }, {
        actorId: auth?.user?.id ?? currentRideSnapshot.driverId ?? currentRideSnapshot.driver?.id ?? 'local_user',
        actorRole,
        correlationId: createRideCorrelationId(),
        timestamp: startedAt,
      });
      const transactionResult = rideTransactionBoundary.evaluate(command, {
        currentRide: buildStartRideTransactionRide(currentRideSnapshot),
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
      recordStartRideTransactionTelemetry(transactionResult, command);
      if (transactionResult.accepted) {
        shadowWireStartRideCommand({
          command,
          rideId: currentRideSnapshot.id,
          startedAt,
          location: null,
          actorId: command.actorId,
          actorRole,
          correlationId: command.correlationId,
          timestamp: command.timestamp,
          capabilitySnapshot: rideCommandCapabilitySnapshot,
        });
      }
    } catch (error) {
      reportOperationalFailure('ride.shadow.start', error, { rideId: currentRideSnapshot.id });
    }
  }, [auth?.user?.id, rideCommandCapabilitySnapshot, timers]);

  const completeRide = useCallback((
    source: 'customer' | 'driver' = 'customer',
    driverIdentity?: { driverId?: string; driverName?: string; vehicleId?: string; vehicleType?: VehicleType },
  ) => {
    timers.endSession();
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    setCurrentRide(prev => {
      if (!prev) return null;
      const driverOwnedFields = source === 'driver' && driverIdentity?.driverId
        ? {
            driverId: driverIdentity.driverId,
            ...(driverIdentity.driverName ? { driverName: driverIdentity.driverName } : {}),
            ...(driverIdentity.vehicleId ? { vehicleId: driverIdentity.vehicleId, matchedVehicleId: driverIdentity.vehicleId } : {}),
            ...(driverIdentity.vehicleType ? { vehicleType: driverIdentity.vehicleType, matchedVehicleType: driverIdentity.vehicleType } : {}),
          }
        : {};
      const completed = {
        ...prev,
        ...driverOwnedFields,
        status: 'completed' as RideStatus,
        completedAt: new Date().toISOString(),
      };
      setRideHistory(hist => [completed, ...hist]);
      void appendRideHistory(completed).catch(error => {
        reportOperationalFailure('ride.history.persist', error, { status: completed.status });
      });
      if (source === 'driver') {
        void driverEntitlement?.deductCreditForCompletedRide(completed.id);
      }
      return null;
    });
    setDriverLocation(null);
  }, [driverEntitlement, timers]);

  const acceptRideRequest = useCallback(() => {
    const request = pendingRequestRef.current;
    if (!request) return;
    timers.startSession();
    const initialMessages = buildInitialNegotiationMessages(request.pickup, request.destination);
    const sessionVehicle = getEligibleOnlineSessionVehicle(auth?.driverProfile, driverEntitlement?.entitlement, request.requestedVehicleType ?? request.vehicleType);
    const actorId = auth?.user?.id ?? 'local_user';
    setCurrentRide({
      ...request,
      status: 'negotiating',
      negotiation: initialMessages,
      matchedVehicleId: request.matchedVehicleId ?? sessionVehicle?.id,
      matchedVehicleType: request.matchedVehicleType ?? sessionVehicle?.vehicleType,
    });
    setPendingRequest(null);
    try {
      shadowWireAcceptRideCommand({
        rideId: request.id,
        driverId: actorId,
        vehicleId: sessionVehicle?.id ?? request.matchedVehicleId ?? null,
        acceptedFare: request.agreedFare ?? request.suggestedFare ?? null,
        actorId,
        actorRole: 'driver',
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
    } catch (error) {
      reportOperationalFailure('ride.shadow.accept', error, { rideId: request.id });
    }
  }, [auth?.driverProfile, auth?.user?.id, driverEntitlement?.entitlement, rideCommandCapabilitySnapshot, timers]);

  const declineRideRequest = useCallback(() => {
    const request = pendingRequestRef.current;
    setPendingRequest(null);
    if (request) {
      const actorId = auth?.user?.id ?? 'local_user';
      try {
        shadowWireDeclineRideCommand({
          rideId: request.id,
          driverId: actorId,
          reason: null,
          actorId,
          actorRole: 'driver',
          capabilitySnapshot: rideCommandCapabilitySnapshot,
        });
      } catch (error) {
        reportOperationalFailure('ride.shadow.decline', error, { rideId: request.id });
      }
    }
  }, [auth?.user?.id, rideCommandCapabilitySnapshot]);

  const simulateIncomingRideRequest = useCallback(() => {
    if (pendingRequestRef.current) return;
    const sessionVehicle = getEligibleOnlineSessionVehicle(auth?.driverProfile, driverEntitlement?.entitlement);
    if (!sessionVehicle) return;
    setPendingRequest(prev => prev ?? buildMockRideRequest(
      sessionVehicle.vehicleType,
      { vehicleId: sessionVehicle.id, vehicleType: sessionVehicle.vehicleType },
    ));
  }, [auth?.driverProfile, driverEntitlement?.entitlement]);

  const riderAcceptWithFare = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentRide(prev => acceptRideWithFare(prev, amount));
  }, []);

  React.useEffect(() => {
    if (currentRide?.status === 'confirmed') {
      const timer = timers.scheduleTimeout(() => {
        updateStatus('arriving');
        startLiveTracking();
      }, CONFIRMED_RIDE_START_DELAY_MS);
      return () => timers.clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed', startLiveTracking, timers]);

  React.useEffect(() => () => {
    timers.endSession();
  }, [timers]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await loadRideHistory();
      if (history) setRideHistory(history);
    } catch (error) {
      reportOperationalFailure('ride.history.load', error);
    }
  }, []);

  const value = useMemo<RideContextType>(() => ({
    pickup,
    setPickup,
    destination,
    setDestination,
    destText,
    setDestText,
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
  }), [
    pickup,
    destination,
    destText,
    acceptCustomerOffer,
    acceptDriverOffer,
    acceptRideRequest,
    cancelRide,
    cancelledSearchDraft,
    clearCancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
    completeRide,
    counterOffer,
    createRide,
    currentRide,
    declineDriverOffer,
    declineRideRequest,
    driverLocation,
    isMatchingPaused,
    loadHistory,
    markArrived,
    pauseDriverMatching,
    pendingRequest,
    restoreBookingOnHomeFocus,
    resumeDriverMatching,
    rideHistory,
    riderAcceptWithFare,
    sendDriverOffer,
    simulateIncomingRideRequest,
    startJourney,
  ]);

  return (
    <RideContext.Provider value={value}>
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide must be used within RideProvider');
  return ctx;
}
