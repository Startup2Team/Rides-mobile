import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
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
import { haversineKm } from '@/utils/mapUtils';
import {
  buildInitialNegotiationMessages,
  buildMockRideRequest,
} from './rideMatching';
import {
  acceptLatestCustomerOffer,
  acceptLatestDriverOffer,
  acceptRideWithFare,
  addCustomerCounterOffer,
  addDriverOffer,
} from './rideNegotiation';
import { appendRideHistory, loadRideHistory } from './ridePersistence';
import { markRideArrived, startRideJourney } from './rideTracking';
import { createRideTimerManager } from './rideTimerManager';
import { cloneBookingDraft, generateRideId } from './rideUtils';
import {
  CANCELLED_RIDE_CLEAR_DELAY_MS,
  CONFIRMED_RIDE_START_DELAY_MS,
  CUSTOMER_LOCATION_ACTIVE_STATUSES,
  CUSTOMER_LOCATION_PUBLISH_INTERVAL_MS,
  CUSTOMER_SEARCH_TIMEOUT_MS,
  RIDE_RECONCILE_INTERVAL_MS,
} from './rideConstants';
import { reportOperationalFailure } from '@/observability/monitoring';
import { resetRideActivity, setRideActivity } from '@/state/rideActivityStore';
import { registerRideReconcileHandler } from '@/state/rideReconcileTrigger';
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
import { createRide as createBackendRide, cancelRide as cancelBackendRide, getActiveRide, type CustomerRide } from '@/services/rides';
import { isTerminalCustomerLocationError, updateCustomerLocation } from '@/services/customerLocation';
import {
  getTrackedCustomerLocationBackgroundRideId,
  startCustomerLocationBackgroundUpdates,
  stopCustomerLocationBackgroundUpdates,
} from '@/services/customerLocationBackgroundTask';
import { getActiveDriverRide } from '@/services/driverRides';
import { readBackendError } from '@/utils/backendErrorMessage';
import { estimateFare } from '@/services/fare';
import { proposeFare as proposeBackendFare, acceptFare as acceptBackendFare, getNegotiationHistory } from '@/services/negotiation';
import {
  declineFare as driverDeclineFare,
  getNegotiationHistory as getDriverNegotiationHistory,
} from '@/services/driverNegotiation';
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
  negotiationMessagesFromHistory,
  parseCustomerCoords,
  parseDriverCoords,
  rideFromActiveRideSnapshot,
  type BackendEventPayload,
} from './rideBackendSync';
import { createCompleteRideCommand, createStartRideCommand } from '@/domains/ride/commandCreators';
import { rideTransactionBoundary } from '@/domains/ride/transactions';
import type { ActiveRideReadModel, RideParticipant, RidePhase as RideProjectionPhase, RideStatus as RideProjectionStatus } from '@/domains/ride/readModels';

// Rough live ETA (minutes) from the driver's real position to a target, using a
// city-average speed. Replaces the static placeholder ETA from the match event so
// "arrives in N min" ticks down as the driver actually approaches (pickup before
// the trip, destination during it).
const AVG_TRIP_SPEED_KMH = 22;
function distanceKmTo(from: Coords, to: Coords | null | undefined): number | null {
  if (!to) return null;
  return haversineKm(from, { latitude: to.latitude, longitude: to.longitude });
}
function etaMinutesTo(from: Coords, to: Coords | null | undefined): number | null {
  const km = distanceKmTo(from, to);
  if (km == null) return null;
  return Math.max(1, Math.round((km / AVG_TRIP_SPEED_KMH) * 60));
}

// Ordering of the non-terminal ride lifecycle, used only to guard
// reconcileActiveRide's status convergence below. The backend only ever
// moves a given ride's status FORWARD through this chain (or straight to
// 'cancelled', handled separately as a dismissal) — it never regresses a
// live ride. So if the server snapshot's status sits further along this
// order than local, local is definitively stale (the socket-died-silently
// case this branch exists to fix) and adopting it is always safe. If local
// sits further along than the server snapshot, that's either (a) a write
// that's genuinely in flight and about to land — self-heals on the very next
// reconcile tick — or (b) a rejected/failed optimistic update that never
// landed on the backend at all. Distinguishing those two without a
// correlated write-confirmation is P2 (outbound accept/arrive/start/complete
// retry) — deliberately out of scope here — so reconcile never rolls local
// status backward; it only ever catches local UP to a server that has moved
// on, never the reverse.
const RECONCILE_STATUS_ORDER: readonly RideStatus[] = [
  'idle',
  'searching',
  'driver_assigned',
  'negotiating',
  'confirmed',
  'arriving',
  'arrived',
  'in_progress',
];

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
  // Driver-side only: the customer's live position, from `customer_location`
  // WS events (see handleDriverSocketEvent). Never populated on the customer's
  // own context.
  const [customerLocation, setCustomerLocation] = useState<Coords | null>(null);
  // Whether foreground location permission is actually granted right now —
  // tracked in state (not read ad hoc) so Flow K can retry starting the
  // background upgrade once a fresh install's async permission prompt (fired
  // by Flow J) resolves, instead of only checking once and never again.
  const [foregroundLocationGranted, setForegroundLocationGranted] = useState(false);
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
  // True once THIS user cancelled the ride — the backend echoes ride_cancelled
  // over the socket, and that echo must not read as "no drivers found".
  const localCancelInitiatedRef = useRef(false);
  const timerManagerRef = useRef(createRideTimerManager());
  const timers = timerManagerRef.current;
  currentRideRef.current = currentRide;
  pendingRequestRef.current = pendingRequest;
  // Socket handlers read these through refs so their useCallback identity does
  // NOT change when the profile/entitlement objects are rebuilt (which happens
  // on every app foreground) — otherwise the driver WebSocket is torn down and
  // re-handshaked each time, for no state change at all.
  const authDriverProfileRef = useRef(auth?.driverProfile ?? null);
  const authUserRef = useRef(auth?.user ?? null);
  const driverEntitlementRef = useRef(driverEntitlement?.entitlement ?? null);
  authDriverProfileRef.current = auth?.driverProfile ?? null;
  authUserRef.current = auth?.user ?? null;
  driverEntitlementRef.current = driverEntitlement?.entitlement ?? null;
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

  // Stops the native customer-location background task when it's tracking a
  // ride that hydration just proved is no longer live for it — the orphan
  // case is a force-kill mid-ride whose task survives app termination, then
  // the ride ends server-side with no RideProvider mounted to run Flow K's
  // cleanup. `viewer === 'driver'` also counts as "not active": the task only
  // ever streams the CUSTOMER's own position, never a driver's.
  const reconcileCustomerLocationBackgroundTask = useCallback(
    async (ride: Ride | null, viewer: 'customer' | 'driver') => {
      const trackedRideId = await getTrackedCustomerLocationBackgroundRideId().catch(() => null);
      if (!trackedRideId) return;
      const stillActive =
        viewer === 'customer' &&
        ride != null &&
        ride.backendRideId === trackedRideId &&
        CUSTOMER_LOCATION_ACTIVE_STATUSES.has(ride.status);
      if (!stillActive) await stopCustomerLocationBackgroundUpdates();
    },
    [],
  );

  // ── Active-ride resume ─────────────────────────────────────────────────────
  // Ask the backend which ride this account is actually on and rehydrate local
  // state from the snapshot. Without this, killing the app mid-ride stranded
  // both roles on their home screens while the server still held the ride:
  // currentRide started null, nothing ever read GET /rides/active, and the
  // socket's ride_state replay was discarded against null state.
  const hydrateActiveRide = useCallback(async () => {
    const user = authUserRef.current;
    if (!user) return;
    // Hydration only fills an empty seat — never clobber a live local ride or
    // a pending driver offer.
    if (currentRideRef.current || pendingRequestRef.current) return;
    const viewer = user.mode === 'driver' ? 'driver' : 'customer';
    try {
      const snapshot = viewer === 'driver' ? await getActiveDriverRide() : await getActiveRide();
      if (!snapshot) {
        await reconcileCustomerLocationBackgroundTask(null, viewer);
        return;
      }
      const ride = rideFromActiveRideSnapshot(snapshot, viewer);
      if (!ride) {
        await reconcileCustomerLocationBackgroundTask(null, viewer);
        return;
      }
      // The snapshot carries no messages — replay the negotiation thread so
      // the resumed conversation isn't empty. Non-fatal: a failed replay must
      // not block rejoining the ride itself.
      try {
        const history =
          viewer === 'driver'
            ? await getDriverNegotiationHistory(snapshot.id)
            : await getNegotiationHistory(snapshot.id);
        ride.negotiation = negotiationMessagesFromHistory(history);
      } catch (historyError) {
        reportOperationalFailure('ride.resume.negotiationHistory', historyError, {
          mode: user.mode,
        });
      }
      // Re-check after the await: a ride created or accepted while the request
      // was in flight wins over the snapshot.
      if (currentRideRef.current || pendingRequestRef.current) return;
      backendRideIdRef.current = snapshot.id;
      backendDrivingRef.current = true;
      // A resumed CONFIRMED ride must still auto-advance to en-route (the app
      // died right after accept); anything further along must not re-fire it.
      driverEnRouteFiredRef.current = ride.status === 'confirmed' ? null : snapshot.id;
      localCancelInitiatedRef.current = false;
      timers.startSession();
      setCurrentRide(ride);
      await reconcileCustomerLocationBackgroundTask(ride, viewer);
    } catch (error) {
      reportOperationalFailure('ride.resume.hydrate', error, { mode: user.mode });
    }
  }, [reconcileCustomerLocationBackgroundTask, timers]);
  // Stable handle for the driver socket handler, whose useCallback identity
  // must not churn (see the ref block above) — a churned identity re-handshakes
  // the WebSocket.
  const hydrateActiveRideRef = useRef(hydrateActiveRide);
  hydrateActiveRideRef.current = hydrateActiveRide;

  // ── Active-ride reconciliation ───────────────────────────────────────────
  // hydrateActiveRide only fills an EMPTY seat — by design it never touches a
  // ride already loaded locally. That leaves a real gap: a WS lifecycle event
  // missed while the tracking socket is down/silently stalled (backgrounded
  // app, dead-but-undetected connection — see the read-idle watchdog in
  // customerTrackingSocket.ts / driverTrackingSocket.ts) leaves a stale ride
  // on screen — a frozen driver pointer, a step the UI never advanced past,
  // or a cancel it never heard about — with nothing to correct it short of a
  // force-kill + relaunch. This re-asks the backend for the truth and:
  //   - dismisses the ride locally (same as a real ride_cancelled WS event)
  //     when the server no longer has it live at all;
  //   - otherwise converges local `status` FORWARD to match the server's,
  //     when the server has moved further along than local — see
  //     RECONCILE_STATUS_ORDER's comment for why this never moves backward.
  // Wired to foreground resume, a light backstop interval while a ride is
  // active, and an inbound reconcile push (state/rideReconcileTrigger.ts) —
  // see each call site below.
  const reconcileActiveRide = useCallback(async () => {
    const user = authUserRef.current;
    if (!user) return;
    const ride = currentRideRef.current;
    if (!ride || ride.status === 'cancelled' || ride.status === 'completed') return;
    const backendRideId = ride.backendRideId ?? backendRideIdRef.current;
    // Nothing for the server to confirm yet (still POSTing / purely local) —
    // there is no server truth to reconcile against.
    if (!backendRideId) return;
    const viewer = user.mode === 'driver' ? 'driver' : 'customer';
    let snapshot: CustomerRide | null;
    try {
      snapshot = viewer === 'driver' ? await getActiveDriverRide() : await getActiveRide();
    } catch (error) {
      // Ambiguous (network/server error) — only a definitive answer from the
      // backend can move this forward; a failed check must never guess.
      reportOperationalFailure('ride.reconcile.fetch', error, { mode: user.mode, rideId: backendRideId });
      return;
    }
    // Re-check after the await: don't clobber a ride that moved on while this
    // was in flight (a live WS event already applied, a local cancel fired,
    // or the ride ended some other way).
    const current = currentRideRef.current;
    if (
      !current ||
      current.backendRideId !== backendRideId ||
      current.status === 'cancelled' ||
      current.status === 'completed'
    ) {
      return;
    }

    const serverRide =
      snapshot && snapshot.id === backendRideId ? rideFromActiveRideSnapshot(snapshot, viewer) : null;

    if (!serverRide) {
      // Server no longer has this ride live (completed/cancelled/gone) —
      // dismiss it locally exactly like a real ride_cancelled WS event would,
      // so a missed event never leaves a zombie ride on screen.
      const session = timers.endSession();
      backendRideIdRef.current = null;
      backendDrivingRef.current = false;
      driverEnRouteFiredRef.current = null;
      setCurrentRide(prev =>
        prev && prev.backendRideId === backendRideId ? { ...prev, status: 'cancelled' } : prev,
      );
      timers.scheduleTimeout(() => {
        setCurrentRide(prev => (prev?.status === 'cancelled' ? null : prev));
        setDriverLocation(null);
        setCustomerLocation(null);
      }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
      await reconcileCustomerLocationBackgroundTask(null, viewer);
      return;
    }

    const localIndex = RECONCILE_STATUS_ORDER.indexOf(current.status);
    const serverIndex = RECONCILE_STATUS_ORDER.indexOf(serverRide.status);
    if (serverIndex <= localIndex) return; // never behind, never regress (see RECONCILE_STATUS_ORDER)

    backendDrivingRef.current = true;
    clearSearchTimers();
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    // A resumed CONFIRMED ride must still auto-advance to en-route locally
    // (mirrors hydrateActiveRide); anything the server already reports past
    // CONFIRMED means en-route already happened server-side, so mark it
    // fired to stop the local auto-advance effect from calling it again.
    driverEnRouteFiredRef.current = serverRide.status === 'confirmed' ? null : backendRideId;
    setCurrentRide(prev => {
      if (!prev || prev.backendRideId !== backendRideId) return prev;
      const next: Ride = { ...prev, status: serverRide.status };
      if (serverRide.agreedFare !== undefined) next.agreedFare = serverRide.agreedFare;
      if (serverRide.arrivedAt) {
        next.arrivedAt = prev.arrivedAt ?? serverRide.arrivedAt;
        next.waitStartedAt = prev.waitStartedAt ?? serverRide.waitStartedAt;
      }
      return next;
    });
    // Deliberately NOT touching driverLocation/customerLocation here: the
    // active-ride snapshot (services/rides.ts CustomerRide) carries no live
    // GPS field — rideFromActiveRideSnapshot seeds driver.location at the
    // pickup point purely as a placeholder for a customer who has no fix
    // yet. Copying that into the live driverLocation/customerLocation
    // pointer would regress a real in-flight fix back to a static point.
    // Once the watchdog-forced reconnect above lands, the real
    // driver_location/customer_location WS stream resumes and repopulates it.
  }, [clearSearchTimers, reconcileCustomerLocationBackgroundTask, timers]);
  // Stable handle so the reconcile trigger (registered once on mount, below)
  // always calls the latest implementation without re-registering.
  const reconcileActiveRideRef = useRef(reconcileActiveRide);
  reconcileActiveRideRef.current = reconcileActiveRide;

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

    const localDist = calcDistance(pickup, destination);
    const localFare = calcFare(vehicleType, localDist);
    // Prefer the backend fare estimate — the SAME source the booking screen shows
    // (GET /customer/fare-estimate) — so distance / fare / ETA are consistent on
    // every screen instead of a different local formula per screen. Falls back to
    // the local calc when offline / unauthenticated.
    const estimate = auth?.user
      ? await estimateFare({
          vehicleType,
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          destLat: destination.latitude,
          destLng: destination.longitude,
        }).catch(() => null)
      : null;
    const dist = estimate?.distanceKm ?? localDist;
    const fare = estimate?.totalFareRwf ?? localFare;
    const duration = estimate?.durationMinutes ?? Math.round(localDist * 3 + 5);

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
      duration,
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
    localCancelInitiatedRef.current = false;
    timers.startSession();
    clearSearchTimers();
    setCurrentRide(ride);
    // Status stays `searching`; the real backend `driver_matched` event
    // (delivered over the customer tracking socket) transitions to `negotiating`.

    // Safety net: the backend ends every search with a ride_cancelled event,
    // but if the socket died mid-search nothing else stops the spinner. Cleared
    // by driver_matched / any lifecycle event via clearSearchTimers. Ends the
    // search the same way the backend give-up does — the in-place "no drivers"
    // state on /searching (status stays 'searching', so navigation keeps the
    // customer on the screen with its real Try-again) — and releases the
    // server-side active_ride pointer so the next booking isn't 409'd.
    matchDriverTimeoutRef.current = timers.scheduleTimeout(() => {
      matchDriverTimeoutRef.current = null;
      const active = currentRideRef.current;
      if (!active || active.id !== ride.id || active.status !== 'searching' || active.searchOutcome) return;
      const timedOutBackendRideId = backendRideIdRef.current;
      if (timedOutBackendRideId) {
        void cancelBackendRide(timedOutBackendRideId).catch(error =>
          reportOperationalFailure('ride.search.timeoutCancel', error, { rideId: timedOutBackendRideId }),
        );
      }
      backendRideIdRef.current = null;
      setCurrentRide(prev =>
        prev && prev.id === ride.id && prev.status === 'searching'
          ? { ...prev, searchOutcome: 'no_drivers', backendRideId: undefined }
          : prev,
      );
    }, CUSTOMER_SEARCH_TIMEOUT_MS);

    // Create the ride on the real backend (best-effort). On success we stash the
    // server ride id so cancel + negotiation hit the same ride, and the customer
    // tracking socket takes over state once the backend starts pushing events.
    const staleBackendRideId = backendRideIdRef.current;
    backendRideIdRef.current = null;
    backendDrivingRef.current = false;
    driverEnRouteFiredRef.current = null;
    if (auth?.user) {
      void (async () => {
        // A leftover search (e.g. a local timeout whose cancel never landed)
        // may still hold the server's active_ride pointer — release it BEFORE
        // the new POST, or it 409s. Sequenced, not fire-and-forget, so the
        // cancel cannot race the create.
        if (staleBackendRideId) {
          await cancelBackendRide(staleBackendRideId).catch(error =>
            reportOperationalFailure('ride.backend.staleCancel', error, { rideId: staleBackendRideId }),
          );
        }
        const res = await createBackendRide({
          vehicleType,
          pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address ?? '' },
          destination: { lat: destination.latitude, lng: destination.longitude, address: destination.address ?? '' },
          initialFare: fare,
          distanceKm: parseFloat(dist.toFixed(2)),
        });
        backendRideIdRef.current = res.rideId;
        setCurrentRide(prev =>
          prev && prev.id === ride.id
            ? {
                ...prev,
                backendRideId: res.rideId,
                // Server-granted search budget (optional fields, rolling out in
                // parallel) — the searching screen counts down against it.
                ...(res.giveUpSeconds != null ? { searchBudgetSeconds: res.giveUpSeconds } : {}),
                ...(res.searchDeadlineAt ? { searchDeadlineAt: res.searchDeadlineAt } : {}),
              }
            : prev,
        );
      })().catch(async error => {
        // The server already holds a live ride for this account. The local
        // "searching" would be fiction — no backend ride backs it, so it could
        // only end in a fake "No drivers found". Rejoin the real ride instead
        // and say so.
        const { code } = readBackendError(error);
        if (code === 'RIDE_ALREADY_ACTIVE') {
          try {
            const snapshot = await getActiveRide();
            const active = snapshot ? rideFromActiveRideSnapshot(snapshot, 'customer') : null;
            if (snapshot && active) {
              // Same replay as hydrateActiveRide: the snapshot has no messages.
              try {
                active.negotiation = negotiationMessagesFromHistory(
                  await getNegotiationHistory(snapshot.id),
                );
              } catch (historyError) {
                reportOperationalFailure('ride.resume.negotiationHistory', historyError, {
                  rideId: ride.id,
                });
              }
              clearSearchTimers();
              backendRideIdRef.current = snapshot.id;
              backendDrivingRef.current = true;
              driverEnRouteFiredRef.current = null;
              setCurrentRide(prev => (prev && prev.id === ride.id ? active : prev));
              Alert.alert(
                'Ride in progress',
                'You already have a ride in progress — taking you back to it.',
              );
              return;
            }
          } catch (hydrateError) {
            reportOperationalFailure('ride.backend.activeAfter409', hydrateError, { rideId: ride.id });
          }
        }
        reportOperationalFailure('ride.backend.create', error, { rideId: ride.id });
      });
    }
  }, [auth?.user, clearSearchTimers, rideCommandCapabilitySnapshot, timers]);

  const cancelRide = useCallback(() => {
    const session = timers.endSession();
    localCancelInitiatedRef.current = true;
    isMatchingPausedRef.current = false;
    setIsMatchingPaused(false);
    clearSearchTimers();
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
    setDriverLocation(null);
    setCustomerLocation(null);
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
    // driver cancel endpoint; customers the customer one. One exception: a
    // driver walking away mid-negotiation must use the negotiation decline
    // endpoint — the generic driver cancel rejects NEGOTIATING
    // (ErrInvalidTransition), so the backend silently kept the ride alive
    // while this app had already gone home, stranding the customer in a
    // zombie negotiation and the driver invisible to matching.
    const backendRideId = backendRideIdRef.current ?? currentRideSnapshot?.backendRideId ?? null;
    if (backendRideId) {
      const cancelOnBackend =
        auth?.user?.mode === 'driver'
          ? currentRideSnapshot?.status === 'negotiating'
            ? driverDeclineFare
            : driverCancelRide
          : cancelBackendRide;
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
    // Optimistically show the customer's own counter-offer, then send it to the
    // backend. The driver's real reply arrives over the WebSocket
    // (negotiation_message) — there is no simulated reply anymore.
    setCurrentRide(prev => addCustomerCounterOffer(prev, amount));
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void proposeBackendFare(backendRideId, amount).catch(error =>
        reportOperationalFailure('ride.backend.propose', error, { rideId: backendRideId }),
      );
    }
  }, []);

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
    // Optimistically show the driver's own offer, then send it to the backend.
    // The customer's real reply arrives over the WebSocket (negotiation_message)
    // — there is no simulated reply anymore.
    setCurrentRide(prev => addDriverOffer(prev, amount));
    const backendRideId = backendRideIdRef.current;
    if (backendRideId) {
      void driverProposeFare(backendRideId, amount).catch(error =>
        reportOperationalFailure('ride.driver.propose', error, { rideId: backendRideId }),
      );
    }
  }, []);

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
    // No simulated jitter — the driver marker moves ONLY from real
    // driver_location WS events. Just clear any stale interval from a prior ride.
    timers.clearInterval(driverIntervalRef.current);
    driverIntervalRef.current = null;
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
    setCustomerLocation(null);
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
        if (coords) {
          setDriverLocation(coords);
          // Recompute a live ETA from the driver's real position → pickup (before
          // the trip) or destination (during it), so it reflects reality instead
          // of the static placeholder set at match time.
          setCurrentRide(prev => {
            if (!prev?.driver) return prev;
            const target = prev.status === 'in_progress' ? prev.destination : prev.pickup;
            const eta = etaMinutesTo(coords, target);
            const distanceKm = distanceKmTo(coords, target);
            const etaChanged = eta != null && eta !== prev.driver.eta;
            const distanceChanged = distanceKm != null && distanceKm !== prev.driver.distanceKm;
            if (!etaChanged && !distanceChanged) return prev;
            return {
              ...prev,
              driver: {
                ...prev.driver,
                ...(eta != null ? { eta } : {}),
                ...(distanceKm != null ? { distanceKm } : {}),
              },
            };
          });
        }
        return;
      }

      if (type === 'driver_matched') {
        backendDrivingRef.current = true;
        clearSearchTimers();
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);
        setCurrentRide(prev => {
          if (!prev) return prev;
          const matched = applyDriverMatched(prev, payload);
          // Seed a real ETA + distance from the driver's position → pickup right
          // away, so the customer cards aren't the placeholder until the first
          // location tick.
          if (coords && matched.driver) {
            const eta = etaMinutesTo(coords, matched.pickup);
            const distanceKm = distanceKmTo(coords, matched.pickup);
            if (eta != null || distanceKm != null) {
              return {
                ...matched,
                driver: {
                  ...matched.driver,
                  ...(eta != null ? { eta } : {}),
                  ...(distanceKm != null ? { distanceKm } : {}),
                },
              };
            }
          }
          return matched;
        });
        return;
      }

      if (isLifecycleEvent(type)) {
        backendDrivingRef.current = true;
        clearSearchTimers();
        timers.clearInterval(driverIntervalRef.current);
        driverIntervalRef.current = null;
        const statusBeforeEvent = currentRideRef.current?.status ?? null;
        const coords = parseDriverCoords(payload);
        if (coords) setDriverLocation(coords);

        // The dispatcher's give-up cancels the ride while we're still
        // 'searching'. Keep the customer ON /searching in its in-place
        // "no drivers" state — with a real Try-again for the same trip —
        // instead of the old Alert + pop-to-home. Status stays 'searching' (so
        // the navigation policy holds the screen); the backend ride is finished,
        // so its id is dropped — the tracking socket closes and nothing later
        // tries to cancel a dead ride. Explicit user cancels
        // (localCancelInitiatedRef) still leave the screen as before.
        if (type === 'ride_cancelled' && statusBeforeEvent === 'searching' && !localCancelInitiatedRef.current) {
          const reason = typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason.trim()
            : undefined;
          backendRideIdRef.current = null;
          timers.endSession();
          setCurrentRide(prev =>
            prev && prev.status === 'searching'
              ? {
                  ...prev,
                  searchOutcome: 'no_drivers',
                  ...(reason ? { searchFailureReason: reason } : {}),
                  backendRideId: undefined,
                }
              : prev,
          );
          return;
        }

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
          authDriverProfileRef.current,
          driverEntitlementRef.current,
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

      // The customer's live position, streamed while the ride is active (see
      // RideProvider's customer-location publish effect). Same shape as
      // driver_location, just the other party.
      if (type === 'customer_location') {
        const coords = parseCustomerCoords(payload);
        if (coords) setCustomerLocation(coords);
        return;
      }

      // The server replays a ride_state snapshot on every (re)connect. It used
      // to be silently discarded here, so a driver whose socket reconnected
      // mid-ride never resynced. Apply it to the local ride when one exists;
      // on a cold reconnect with no local ride the snapshot only carries the
      // status, so pull the full ride over REST instead. The replay may also
      // carry the customer's last-known fix as customer_lat/customer_lng —
      // seed it regardless of whether a local ride exists yet, so a driver
      // whose socket reconnects mid-ride doesn't wait a full publish interval
      // to see the customer marker again.
      if (type === 'ride_state') {
        const customerCoords = parseCustomerCoords(payload);
        if (customerCoords) setCustomerLocation(customerCoords);
        const local = localStatusFromBackend(payload.status);
        if (!local) return;
        backendDrivingRef.current = true;
        if (!currentRideRef.current) {
          if (local !== 'completed' && local !== 'cancelled') {
            void hydrateActiveRideRef.current();
          }
          return;
        }
        setCurrentRide(prev => (prev ? { ...prev, status: local } : prev));
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
          setCustomerLocation(null);
        }, CANCELLED_RIDE_CLEAR_DELAY_MS, session);
        return;
      }

      // The customer accepting the fare confirms the ride on the backend, which
      // pushes ride_confirmed to the driver socket. Without handling it here the
      // driver stayed stuck on the negotiation screen ("typing…") while the
      // customer had already advanced. Apply it so status → 'confirmed' and the
      // driver flow navigation moves them to the navigate/pickup screen.
      if (type === 'ride_confirmed') {
        backendDrivingRef.current = true;
        setCurrentRide(prev => (prev ? applyLifecycleEvent(prev, 'ride_confirmed', payload) : prev));
        return;
      }

      if (type === 'negotiation_message' || type === 'negotiation_declined' || type === 'negotiation_text') {
        setCurrentRide(prev => (prev ? appendNegotiationEvent(prev, payload, 'driver') : prev));
      }
    },
    [timers],
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

  // Seeds foregroundLocationGranted for a returning user who already granted
  // foreground location in a past session — without this, Flow K would only
  // ever learn about the grant via Flow J's own request call below, which
  // only fires once a ride is actually active.
  React.useEffect(() => {
    let cancelled = false;
    void Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (!cancelled && status === 'granted') setForegroundLocationGranted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Flow J: customer live location publish ───────────────────────────────
  // Streams the customer's real GPS to the driver (POST …/customer-location)
  // for the whole active window of the ride — from the fare being locked in
  // (CONFIRMED) through the trip itself (IN_PROGRESS), never before
  // acceptance and never once the ride ends. Mirrors the driver's own
  // location-report loop in app/(driver)/index.tsx: fire immediately + every
  // CUSTOMER_LOCATION_PUBLISH_INTERVAL_MS, fire-and-forget. The backend
  // pushes the fix back out to the driver as a `customer_location` WS event
  // (handled above) — this effect only publishes, it never reads the result.
  const isCustomerLocationPublishActive =
    auth?.user?.mode !== 'driver' &&
    Boolean(trackedRideId) &&
    currentRide != null &&
    CUSTOMER_LOCATION_ACTIVE_STATUSES.has(currentRide.status);
  React.useEffect(() => {
    if (!isCustomerLocationPublishActive || !trackedRideId) return;
    let cancelled = false;
    let permissionGranted = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const publish = async () => {
      if (cancelled) return;
      try {
        if (!permissionGranted) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          permissionGranted = status === 'granted';
          if (permissionGranted) setForegroundLocationGranted(true);
        }
        if (!permissionGranted || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        // expo-location reports speed in metres/second; the backend field is
        // speed_kmh, so convert (m/s → km/h) before sending.
        const speedMps = loc.coords.speed;
        const heading = loc.coords.heading;
        await updateCustomerLocation(trackedRideId, {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          // -1 = unknown course on iOS/Android; sending it 400s the whole
          // update backend-side, so only send a real 0-360 bearing.
          heading: heading != null && heading >= 0 ? heading : undefined,
          speed: speedMps != null && speedMps >= 0 ? speedMps * 3.6 : undefined,
        });
      } catch (error) {
        // Endpoint not deployed yet, offline, or permission revoked mid-ride —
        // ignore and retry on the next tick. Never surfaced to the rider. A
        // definitive 404/409 (the ride already ended on the backend) never
        // recovers on retry, though — stop the loop instead of polling a
        // dead ride forever.
        if (isTerminalCustomerLocationError(error)) {
          cancelled = true;
          if (intervalId != null) clearInterval(intervalId);
        }
      }
    };
    void publish();
    intervalId = setInterval(() => void publish(), CUSTOMER_LOCATION_PUBLISH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [isCustomerLocationPublishActive, trackedRideId]);

  // ── Flow K: customer background location (product decision: whole-trip,
  // survives the app being backgrounded) ──────────────────────────────────
  // Purely additive on top of Flow J: while the JS interval above already
  // covers the app-open case, this asks to upgrade to "Always" so a native
  // background task keeps streaming when the app is backgrounded/suspended.
  // Deliberately its own effect (and its own commit) so it can be reverted
  // independently of the foreground streaming — App Store review treats
  // background location very differently from foreground.
  //
  // foregroundLocationGranted is a dependency (not just an inline check)
  // because on a fresh install Flow J's permission request is still pending
  // the first time this effect runs — startCustomerLocationBackgroundUpdates
  // would see "not granted" and bail, and without this dependency the effect
  // would never re-run to retry once the user actually grants it.
  React.useEffect(() => {
    if (!isCustomerLocationPublishActive || !trackedRideId) return;
    void startCustomerLocationBackgroundUpdates(trackedRideId);
    return () => {
      void stopCustomerLocationBackgroundUpdates();
    };
  }, [foregroundLocationGranted, isCustomerLocationPublishActive, trackedRideId]);

  // Resume check: once auth is ready (and again on every mode change), and on
  // each return to the foreground. A single cheap GET that no-ops while a ride
  // is already loaded — see hydrateActiveRide. reconcileActiveRide is the
  // companion check for a ride already loaded (see its own comment) — both
  // belong on every return to the foreground. Also nudges either tracking
  // socket to reconnect immediately if it isn't demonstrably open, instead of
  // waiting out a backoff delay computed while the app was backgrounded.
  const authUserId = auth?.user?.id ?? null;
  const authUserMode = auth?.user?.mode ?? null;
  React.useEffect(() => {
    if (!authUserId) return;
    void hydrateActiveRide();
    void reconcileActiveRide();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void hydrateActiveRide();
      void reconcileActiveRide();
      customerSocketRef.current?.ensureAlive?.();
      driverSocketRef.current?.ensureAlive?.();
    });
    return () => subscription.remove();
  }, [authUserId, authUserMode, hydrateActiveRide, reconcileActiveRide]);

  // Backstop: while a non-terminal ride is loaded, periodically re-verify it
  // against the backend too — catches a socket that's gone silently stuck
  // (not just a backgrounded app) without waiting for the next foreground
  // return. See RIDE_RECONCILE_INTERVAL_MS.
  const reconcileEligible =
    Boolean(currentRide?.backendRideId) &&
    currentRide?.status !== 'cancelled' &&
    currentRide?.status !== 'completed';
  React.useEffect(() => {
    if (!reconcileEligible) return;
    const handle = timers.scheduleInterval(() => {
      void reconcileActiveRide();
    }, RIDE_RECONCILE_INTERVAL_MS);
    return () => timers.clearInterval(handle);
  }, [reconcileActiveRide, reconcileEligible, timers]);

  // Registers the reconcile handler once so a push whose data implies the
  // ride may have moved on (services/usePushNotifications.ts) can self-heal a
  // missed WS event by triggering the same check — see
  // state/rideReconcileTrigger.ts. Always calls through to the LATEST
  // reconcileActiveRide via the ref, so this never needs to re-register.
  React.useEffect(() => {
    registerRideReconcileHandler(() => {
      void reconcileActiveRideRef.current();
    });
    return () => registerRideReconcileHandler(null);
  }, []);

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
    // we are the driver) the real driver_en_route event advances the ride. The
    // driver marker now moves solely from real `driver_location` events, so this
    // fallback only advances status (no simulated jitter).
    if (backendDrivingRef.current || auth?.user?.mode === 'driver') return;
    if (currentRide?.status === 'confirmed') {
      const timer = timers.scheduleTimeout(() => {
        if (backendDrivingRef.current) return;
        updateStatus('arriving');
      }, CONFIRMED_RIDE_START_DELAY_MS);
      return () => timers.clearTimeout(timer);
    }
  }, [currentRide?.status === 'confirmed', auth?.user?.mode, timers]);

  React.useEffect(() => () => {
    timers.endSession();
  }, [timers]);

  // Publish ride activity so AuthContext.switchMode can refuse a mid-ride role
  // switch (the source of the customer/driver navigator duel) without needing
  // to consume RideContext.
  React.useEffect(() => {
    setRideActivity(currentRide?.status ?? null, Boolean(pendingRequest));
  }, [currentRide?.status, pendingRequest]);
  React.useEffect(() => () => resetRideActivity(), []);

  // Once a ride COMPLETES, drop the saved booking draft so returning Home lands on
  // a clean home screen — not the pickup/booking form (the draft-restore is only
  // meant for a CANCELLED search the rider may want to resume, not a finished trip).
  React.useEffect(() => {
    if (currentRide?.status === 'completed') {
      setCancelledSearchDraft(null);
      setRestoreBookingOnHomeFocus(false);
    }
  }, [currentRide?.status]);

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
    customerLocation,
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
    customerLocation,
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
