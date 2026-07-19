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
import { RideContextType } from './rideTypes';
import { resolveCapabilities, type CapabilitySnapshot } from '@/capabilities';
import { calcDistance, calcFare } from './rideFare';
import {
  buildInitialNegotiationMessages,
  buildMockRideRequest,
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
import { createRideTimerManager } from './rideTimerManager';
import { cloneBookingDraft, generateRideId } from './rideUtils';
import {
  ARRIVING_TRACKING_INTERVAL_MS,
  ARRIVING_TRACKING_NOISE,
  ARRIVING_TRACKING_STEPS,
  CANCELLED_RIDE_CLEAR_DELAY_MS,
  CONFIRMED_RIDE_START_DELAY_MS,
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
  shadowWireCompleteRideCommand,
  shadowWireDeclineRideCommand,
  shadowWireRequestRideCommand,
  shadowWireStartRideCommand,
} from '@/domains/ride/commandPipeline';
import { createRideCorrelationId } from '@/domains/ride/idempotency';
import { createRide as createBackendRide, cancelRide as cancelBackendRide } from '@/services/rides';
import { proposeFare as proposeBackendFare, acceptFare as acceptBackendFare } from '@/services/negotiation';
import {
  acceptRide as driverAcceptRide,
  declineRide as driverDeclineRide,
  driverCancelRide,
  markEnRoute as driverMarkEnRoute,
  markArrived as driverMarkArrivedBackend,
  startTrip as driverStartTrip,
  completeTrip as driverCompleteTrip,
} from '@/services/driverRides';
import {
  proposeFare as driverProposeFare,
  acceptFare as driverAcceptFare,
  lockManualFare as driverLockManualFare,
} from '@/services/driverNegotiation';
import { openCustomerTrackingSocket, type CustomerTrackingSocket } from '@/services/customerTrackingSocket';
import { openDriverSocket, type DriverSocket } from '@/services/driverTrackingSocket';
import {
  appendNegotiationEvent,
  applyDriverMatched,
  applyLifecycleEvent,
  buildDriverRequestFromPayload,
  isDriverRequestEvent,
  isLifecycleEvent,
  localStatusFromBackend,
  parseDriverCoords,
  type BackendEventPayload,
} from './rideBackendSync';
import { createCompleteRideCommand, createStartRideCommand } from '@/domains/ride/commandCreators';
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
  // Server-assigned ride id for the in-flight booking. Populated best-effort by
  // the real POST /customer/rides so cancel + negotiation calls target the same
  // ride on the backend while the UI is still driven by the local simulation
  // (the WebSocket takes over state transitions in the next flow).
  const backendRideIdRef = useRef<string | null>(null);
  // Live tracking sockets (Flows D + I). `backendDrivingRef` flips true once a
  // real WS event drives state, so the local simulation timers stand down and
  // the server becomes the source of truth for status transitions.
  const customerSocketRef = useRef<CustomerTrackingSocket | null>(null);
  const driverSocketRef = useRef<DriverSocket | null>(null);
  const backendDrivingRef = useRef(false);
  const driverEnRouteFiredRef = useRef<string | null>(null);
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

  const pauseDriverMatching = useCallback(() => {
    isMatchingPausedRef.current = true;
    setIsMatchingPaused(true);
    clearSearchTimers();
  }, [clearSearchTimers]);

  // Matching is driven entirely by the backend customer tracking socket
  // (`driver_matched` → negotiating). Resuming just clears the paused flag; the
  // real match arrives over the WebSocket, so there is nothing local to restart.
  const resumeDriverMatching = useCallback(() => {
    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
  }, []);

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

  function recordCompleteRideTransactionTelemetry(
    preview: ReturnType<typeof rideTransactionBoundary.preview>,
    result: ReturnType<typeof rideTransactionBoundary.evaluate>,
    command: ReturnType<typeof createCompleteRideCommand>,
  ) {
    observability.metrics.counter('ride.complete_transaction.preview', 1, {
      rideId: command.payload.rideId,
      commandId: command.commandId,
    });
    observability.logger.info('RideCompleteTransactionPreview', {
      rideId: command.payload.rideId,
      commandId: command.commandId,
      actorId: command.actorId,
      actorRole: command.actorRole,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      commandType: result.commandType,
      status: result.state,
      financialPreviewMode: preview?.financialPreview?.mode ?? null,
    });

    if (preview?.financialPreview) {
      observability.metrics.counter('ride.complete_transaction.financial_preview', 1, {
        rideId: command.payload.rideId,
        commandId: command.commandId,
      });
      observability.logger.info('RideCompleteTransactionFinancialPreview', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        actorId: command.actorId,
        actorRole: command.actorRole,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
        effects: preview.financialPreview.effects.map(effect => effect.name),
        notes: preview.financialPreview.notes,
      });
    }

    if (result.accepted) {
      observability.metrics.counter('ride.complete_transaction.accepted', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.info('RideCompleteTransactionAccepted', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        actorId: command.actorId,
        actorRole: command.actorRole,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
      return;
    }

    observability.metrics.counter('ride.complete_transaction.rejected', 1, {
      rideId: command.payload.rideId,
    });
    observability.logger.warn('RideCompleteTransactionRejected', {
      rideId: command.payload.rideId,
      commandId: command.commandId,
      actorId: command.actorId,
      actorRole: command.actorRole,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      reason: result.reason,
    });

    if (result.orderingViolation) {
      observability.metrics.counter('ride.complete_transaction.ordering_violation', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideCompleteTransactionOrderingViolation', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        actorId: command.actorId,
        actorRole: command.actorRole,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
    }

    if (result.duplicate) {
      observability.metrics.counter('ride.complete_transaction.duplicate_detected', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideCompleteTransactionDuplicateDetected', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        actorId: command.actorId,
        actorRole: command.actorRole,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
    }

    if (result.reason === 'capability-denied') {
      observability.metrics.counter('ride.complete_transaction.capability_denied', 1, {
        rideId: command.payload.rideId,
      });
      observability.logger.warn('RideCompleteTransactionCapabilityDenied', {
        rideId: command.payload.rideId,
        commandId: command.commandId,
        actorId: command.actorId,
        actorRole: command.actorRole,
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
    // Status stays `searching`; the real backend `driver_matched` event
    // (delivered over the customer tracking socket) transitions to `negotiating`.

    // Create the ride on the real backend (best-effort). On success we stash the
    // server ride id so cancel + negotiation hit the same ride, and the customer
    // tracking socket takes over state once the backend starts pushing events.
    backendRideIdRef.current = null;
    backendDrivingRef.current = false;
    driverEnRouteFiredRef.current = null;
    if (auth?.user) {
      void createBackendRide({
        vehicleType,
        pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address ?? '' },
        destination: { lat: destination.latitude, lng: destination.longitude, address: destination.address ?? '' },
        initialFare: fare,
        distanceKm: parseFloat(dist.toFixed(2)),
      })
        .then(res => {
          backendRideIdRef.current = res.rideId;
          setCurrentRide(prev => (prev && prev.id === ride.id ? { ...prev, backendRideId: res.rideId } : prev));
        })
        .catch(error => reportOperationalFailure('ride.backend.create', error, { rideId: ride.id }));
    }
  }, [auth?.user, clearSearchTimers, rideCommandCapabilitySnapshot, timers]);

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
    // Cancel the ride on the real backend too (best-effort). Drivers hit the
    // driver cancel endpoint; customers the customer one.
    const backendRideId = backendRideIdRef.current ?? currentRideSnapshot?.backendRideId ?? null;
    if (backendRideId) {
      const cancelOnBackend = auth?.user?.mode === 'driver' ? driverCancelRide : cancelBackendRide;
      void cancelOnBackend(backendRideId).catch(error =>
        reportOperationalFailure('ride.backend.cancel', error, { rideId: backendRideId }),
      );
    }
    backendRideIdRef.current = null;
    backendDrivingRef.current = false;
    driverEnRouteFiredRef.current = null;
    setCurrentRide(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    timers.scheduleTimeout(() => {
      setCurrentRide(prev => prev?.status === 'cancelled' ? null : prev);
    }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
  }, [auth?.user?.id, auth?.user?.mode, clearSearchTimers, rideCommandCapabilitySnapshot, timers]);

  const counterOffer = useCallback((amount: number) => {
    setCurrentRide(prev => addCustomerCounterOffer(prev, amount));

    // Mirror the customer's counter-offer to the backend negotiation (best-effort).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void proposeBackendFare(backendRideId, amount).catch(error =>
        reportOperationalFailure('ride.backend.propose', error, { rideId: backendRideId }),
      );
    }

    timers.scheduleTimeout(() => {
      if (backendDrivingRef.current) return;
      setCurrentRide(prev => respondToCustomerCounterOffer(prev, amount));
    }, NEGOTIATION_RESPONSE_DELAY_MS);
  }, [timers]);

  const acceptDriverOffer = useCallback(() => {
    setCurrentRide(acceptLatestDriverOffer);
    // Accept the driver's fare on the backend negotiation (best-effort).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void acceptBackendFare(backendRideId).catch(error =>
        reportOperationalFailure('ride.backend.accept', error, { rideId: backendRideId }),
      );
    }
  }, []);

  const sendDriverOffer = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentRide(prev => addDriverOffer(prev, amount));
    // Mirror the driver's offer to the backend negotiation (best-effort).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void driverProposeFare(backendRideId, amount).catch(error =>
        reportOperationalFailure('ride.driver.propose', error, { rideId: backendRideId }),
      );
    }
    // Only fall back to a simulated customer reply when the backend WS is not
    // driving the negotiation — real negotiation_message events take over then.
    timers.scheduleTimeout(() => {
      if (backendDrivingRef.current) return;
      setCurrentRide(prev => addCustomerAutoReply(prev, amount));
    }, NEGOTIATION_RESPONSE_DELAY_MS);
  }, [timers]);

  const acceptCustomerOffer = useCallback(() => {
    setCurrentRide(acceptLatestCustomerOffer);
    // Lock in the customer's fare on the backend negotiation (→ CONFIRMED).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void driverAcceptFare(backendRideId).catch(error =>
        reportOperationalFailure('ride.driver.accept_fare', error, { rideId: backendRideId }),
      );
    }
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
    // Driver marks arrival at pickup on the backend (→ DRIVER_ARRIVED).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void driverMarkArrivedBackend(backendRideId).catch(error =>
        reportOperationalFailure('ride.driver.arrive', error, { rideId: backendRideId }),
      );
    }
  }, [timers]);

  const startJourney = useCallback(() => {
    const currentRideSnapshot = currentRideRef.current;
    const startedAt = new Date().toISOString();
    setCurrentRide(startRideJourney);
    // Driver starts the trip on the backend (→ IN_PROGRESS).
    const backendRideIdForStart = backendRideIdRef.current;
    if (backendRideIdForStart) {
      void driverStartTrip(backendRideIdForStart).catch(error =>
        reportOperationalFailure('ride.driver.start', error, { rideId: backendRideIdForStart }),
      );
    }
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
    const currentRideSnapshot = currentRideRef.current;
    timers.endSession();
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    // Complete the trip on the backend before clearing the server ride id
    // (driver-initiated only — the customer receives completion over the WS).
    const backendRideIdForComplete = backendRideIdRef.current;
    if (source === 'driver' && backendRideIdForComplete) {
      const finalDest = currentRideSnapshot
        ? {
            destLat: currentRideSnapshot.destination.latitude,
            destLng: currentRideSnapshot.destination.longitude,
            destAddress: currentRideSnapshot.destination.address ?? undefined,
          }
        : undefined;
      void driverCompleteTrip(backendRideIdForComplete, finalDest).catch(error =>
        reportOperationalFailure('ride.driver.complete', error, { rideId: backendRideIdForComplete }),
      );
    }
    backendRideIdRef.current = null;
    driverEnRouteFiredRef.current = null;
    backendDrivingRef.current = false;
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
    if (!currentRideSnapshot) return;
    const completedAt = new Date().toISOString();
    const actorRole = source === 'driver' ? 'driver' : 'system';
    const actorId = source === 'driver'
      ? auth?.user?.id ?? driverIdentity?.driverId ?? currentRideSnapshot.driverId ?? currentRideSnapshot.driver?.id ?? 'local_user'
      : auth?.user?.id ?? currentRideSnapshot.customerId ?? 'local_user';
    try {
      const command = createCompleteRideCommand({
        rideId: currentRideSnapshot.id,
        completedAt,
        location: null,
        distanceKm: null,
        durationSeconds: null,
      }, {
        actorId,
        actorRole,
        correlationId: createRideCorrelationId(),
        timestamp: completedAt,
      });
      const transactionPreview = rideTransactionBoundary.preview(command, {
        currentRide: buildStartRideTransactionRide(currentRideSnapshot),
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
      const transactionResult = rideTransactionBoundary.evaluate(command, {
        currentRide: buildStartRideTransactionRide(currentRideSnapshot),
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
      recordCompleteRideTransactionTelemetry(transactionPreview, transactionResult, command);
      shadowWireCompleteRideCommand({
        command,
        rideId: currentRideSnapshot.id,
        completedAt,
        location: null,
        distanceKm: null,
        durationSeconds: null,
        actorId: command.actorId,
        actorRole,
        correlationId: command.correlationId,
        timestamp: command.timestamp,
        capabilitySnapshot: rideCommandCapabilitySnapshot,
      });
    } catch (error) {
      reportOperationalFailure('ride.shadow.complete', error, { rideId: currentRideSnapshot.id });
    }
  }, [auth?.user?.id, driverEntitlement, rideCommandCapabilitySnapshot, timers]);

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
    // Accept the assignment on the real backend (matched → negotiating) and
    // remember the server ride id so the rest of the lifecycle targets it.
    const backendRideId = request.backendRideId ?? null;
    backendRideIdRef.current = backendRideId;
    driverEnRouteFiredRef.current = null;
    if (backendRideId) {
      backendDrivingRef.current = true;
      void driverAcceptRide(backendRideId).catch(error =>
        reportOperationalFailure('ride.driver.accept', error, { rideId: backendRideId }),
      );
    }
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
      // Decline on the real backend so the matcher can re-offer to another driver.
      if (request.backendRideId) {
        void driverDeclineRide(request.backendRideId).catch(error =>
          reportOperationalFailure('ride.driver.decline', error, { rideId: request.backendRideId }),
        );
      }
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
    // Driver locks a manual (non-negotiated) fare on the backend (→ CONFIRMED).
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void driverLockManualFare(backendRideId, amount).catch(error =>
        reportOperationalFailure('ride.driver.lock_fare', error, { rideId: backendRideId }),
      );
    }
  }, []);

  // ── Flow D: customer live tracking socket ────────────────────────────────
  // Maps inbound backend events to local ride state, replacing the simulation
  // timers as the source of truth once the server starts pushing.
  const handleCustomerTrackingEvent = useCallback(
    (event: { type: string; payload: BackendEventPayload }) => {
      const { type, payload } = event;

      if (type === 'driver_location') {
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);
        return;
      }

      if (type === 'driver_matched') {
        backendDrivingRef.current = true;
        clearSearchTimers();
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);
        setCurrentRide(prev => (prev ? applyDriverMatched(prev, payload) : prev));
        return;
      }

      if (isLifecycleEvent(type)) {
        backendDrivingRef.current = true;
        clearSearchTimers();
        timers.clearInterval(driverIntervalRef.current);
        driverIntervalRef.current = null;
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);
        setCurrentRide(prev => (prev ? applyLifecycleEvent(prev, type, payload) : prev));

        if (type === 'ride_completed') {
          const session = timers.endSession();
          const snapshot = currentRideRef.current;
          if (snapshot) {
            const completed = applyLifecycleEvent(snapshot, 'ride_completed', payload);
            setRideHistory(hist => [completed, ...hist]);
            void appendRideHistory(completed).catch(error =>
              reportOperationalFailure('ride.history.persist', error, { status: completed.status }),
            );
          }
          timers.scheduleTimeout(() => {
            setCurrentRide(prev => (prev?.status === 'completed' ? null : prev));
            setDriverLocation(null);
          }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
        }

        if (type === 'ride_cancelled') {
          const session = timers.endSession();
          timers.scheduleTimeout(() => {
            setCurrentRide(prev => (prev?.status === 'cancelled' ? null : prev));
            setDriverLocation(null);
          }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
        }
        return;
      }

      if (type === 'ride_state') {
        const local = localStatusFromBackend(payload.status);
        if (local) {
          backendDrivingRef.current = true;
          setCurrentRide(prev => (prev ? { ...prev, status: local } : prev));
        }
        return;
      }

      if (type === 'negotiation_message' || type === 'negotiation_declined' || type === 'negotiation_text') {
        setCurrentRide(prev => (prev ? appendNegotiationEvent(prev, payload, 'customer') : prev));
      }
    },
    [clearSearchTimers, timers],
  );

  // ── Flow I: driver live socket ───────────────────────────────────────────
  // Receives incoming ride requests + lifecycle/negotiation events, replacing
  // the local simulateIncomingRideRequest mock.
  const handleDriverSocketEvent = useCallback(
    (event: { type: string; payload: BackendEventPayload }) => {
      const { type, payload } = event;

      if (isDriverRequestEvent(type)) {
        if (pendingRequestRef.current || currentRideRef.current) return;
        const sessionVehicle = getEligibleOnlineSessionVehicle(
          auth?.driverProfile,
          driverEntitlement?.entitlement,
        );
        const request = buildDriverRequestFromPayload(
          payload,
          sessionVehicle ? { vehicleId: sessionVehicle.id, vehicleType: sessionVehicle.vehicleType } : undefined,
        );
        if (request) setPendingRequest(request);
        return;
      }

      if (type === 'driver_location') {
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);
        return;
      }

      if (type === 'ride_cancelled') {
        backendDrivingRef.current = true;
        setPendingRequest(null);
        const session = timers.endSession();
        setCurrentRide(prev => (prev ? { ...prev, status: 'cancelled' } : prev));
        timers.scheduleTimeout(() => {
          setCurrentRide(prev => (prev?.status === 'cancelled' ? null : prev));
          setDriverLocation(null);
        }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
        return;
      }

      if (type === 'negotiation_message' || type === 'negotiation_declined' || type === 'negotiation_text') {
        setCurrentRide(prev => (prev ? appendNegotiationEvent(prev, payload, 'driver') : prev));
      }
    },
    [auth?.driverProfile, driverEntitlement?.entitlement, timers],
  );

  const trackedRideId = currentRide?.backendRideId ?? null;
  const isCustomerTrackingActive =
    Boolean(trackedRideId) &&
    auth?.user?.mode !== 'driver' &&
    currentRide?.status !== 'completed' &&
    currentRide?.status !== 'cancelled';
  React.useEffect(() => {
    if (!isCustomerTrackingActive || !trackedRideId) return;
    const socket = openCustomerTrackingSocket(trackedRideId, {
      onEvent: handleCustomerTrackingEvent,
      onError: error => reportOperationalFailure('ride.ws.customer', error, { rideId: trackedRideId }),
    });
    customerSocketRef.current = socket;
    return () => {
      socket.close();
      customerSocketRef.current = null;
    };
  }, [handleCustomerTrackingEvent, isCustomerTrackingActive, trackedRideId]);

  const isDriverSocketActive =
    auth?.user?.mode === 'driver' && auth?.driverProfile?.isOnline === true;
  React.useEffect(() => {
    if (!isDriverSocketActive) return;
    const socket = openDriverSocket({
      onEvent: handleDriverSocketEvent,
      onError: error => reportOperationalFailure('ride.ws.driver', error),
    });
    driverSocketRef.current = socket;
    return () => {
      socket.close();
      driverSocketRef.current = null;
    };
  }, [handleDriverSocketEvent, isDriverSocketActive]);

  // Driver: mark en-route once a backend-backed ride is confirmed (covers both
  // negotiation paths), so it advances to DRIVER_EN_ROUTE. Fires once per ride.
  React.useEffect(() => {
    if (auth?.user?.mode !== 'driver') return;
    if (currentRide?.status !== 'confirmed') return;
    const backendRideId = backendRideIdRef.current;
    if (!backendRideId || driverEnRouteFiredRef.current === backendRideId) return;
    driverEnRouteFiredRef.current = backendRideId;
    void driverMarkEnRoute(backendRideId).catch(error =>
      reportOperationalFailure('ride.driver.en_route', error, { rideId: backendRideId }),
    );
  }, [auth?.user?.mode, currentRide?.status]);

  React.useEffect(() => {
    // Local simulation fallback only — when the backend WS is driving state (or
    // we are the driver) the real driver_en_route event advances the ride.
    if (backendDrivingRef.current || auth?.user?.mode === 'driver') return;
    if (currentRide?.status === 'confirmed') {
      const timer = timers.scheduleTimeout(() => {
        if (backendDrivingRef.current) return;
        updateStatus('arriving');
        startLiveTracking();
      }, CONFIRMED_RIDE_START_DELAY_MS);
      return () => timers.clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed', auth?.user?.mode, startLiveTracking, timers]);

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
