import {
  emitRideActiveRideCanaryFallbackRecordedTelemetry,
  emitRideActiveRideCanaryRollbackRecordedTelemetry,
  emitRideActiveRideCanaryStabilityApprovedTelemetry,
  emitRideActiveRideCanaryStabilityDeniedTelemetry,
  emitRideActiveRideCanaryStabilityUpdatedTelemetry,
} from '../canary/canaryMetrics';

export interface ActiveRideCanaryStabilityThresholds {
  minimumSuccessfulProjectedReads: number;
  minimumObservationWindowMs: number;
  maximumFallbackRate: number;
}

export interface ActiveRideCanaryStabilityState {
  projectedSourceSelections: number;
  liveFallbacks: number;
  gateDenials: number;
  mappingFailures: number;
  staleProjectionIncidents: number;
  comparisonMismatches: number;
  rollbackEvents: number;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  lastMismatchAt: string | null;
  lastFallbackAt: string | null;
  lastProjectedSelectionAt: string | null;
  lastGateDenialAt: string | null;
  lastMappingFailureAt: string | null;
  lastStaleProjectionAt: string | null;
  lastRollbackAt: string | null;
}

export interface ActiveRideCanaryStabilitySnapshot extends ActiveRideCanaryStabilityState {
  observationWindowMs: number;
  fallbackRate: number;
  timeSinceLastMismatchMs: number | null;
  timeSinceLastFallbackMs: number | null;
  ready: boolean;
  reason: string;
}

export const DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS: ActiveRideCanaryStabilityThresholds = {
  minimumSuccessfulProjectedReads: 30,
  minimumObservationWindowMs: 15 * 60 * 1000,
  maximumFallbackRate: 0.01,
};

const activeRideCanaryStabilityState: ActiveRideCanaryStabilityState = {
  projectedSourceSelections: 0,
  liveFallbacks: 0,
  gateDenials: 0,
  mappingFailures: 0,
  staleProjectionIncidents: 0,
  comparisonMismatches: 0,
  rollbackEvents: 0,
  startedAt: null,
  lastUpdatedAt: null,
  lastMismatchAt: null,
  lastFallbackAt: null,
  lastProjectedSelectionAt: null,
  lastGateDenialAt: null,
  lastMappingFailureAt: null,
  lastStaleProjectionAt: null,
  lastRollbackAt: null,
};

function nowIso() {
  return new Date().toISOString();
}

function msBetween(startedAt: string | null, endedAt: string | null) {
  if (!startedAt || !endedAt) return 0;
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

function durationSince(timestamp: string | null) {
  if (!timestamp) return null;
  return Math.max(0, Date.now() - new Date(timestamp).getTime());
}

function updateState(partial: Partial<ActiveRideCanaryStabilityState>) {
  if (!activeRideCanaryStabilityState.startedAt) {
    activeRideCanaryStabilityState.startedAt = partial.lastUpdatedAt ?? nowIso();
  }
  Object.assign(activeRideCanaryStabilityState, partial, {
    lastUpdatedAt: partial.lastUpdatedAt ?? nowIso(),
  });
}

function emitUpdatedTelemetry(reason: string) {
  emitRideActiveRideCanaryStabilityUpdatedTelemetry({
    reason,
    projectedSourceSelections: activeRideCanaryStabilityState.projectedSourceSelections,
    liveFallbacks: activeRideCanaryStabilityState.liveFallbacks,
    gateDenials: activeRideCanaryStabilityState.gateDenials,
    mappingFailures: activeRideCanaryStabilityState.mappingFailures,
    staleProjectionIncidents: activeRideCanaryStabilityState.staleProjectionIncidents,
    comparisonMismatches: activeRideCanaryStabilityState.comparisonMismatches,
    rollbackEvents: activeRideCanaryStabilityState.rollbackEvents,
  });
}

export function recordActiveRideCanaryProjectedSelection() {
  updateState({
    projectedSourceSelections: activeRideCanaryStabilityState.projectedSourceSelections + 1,
    lastProjectedSelectionAt: nowIso(),
  });
  emitUpdatedTelemetry('projected-selection');
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryFallback(reason: string) {
  updateState({
    liveFallbacks: activeRideCanaryStabilityState.liveFallbacks + 1,
    lastFallbackAt: nowIso(),
  });
  emitRideActiveRideCanaryFallbackRecordedTelemetry({ reason });
  emitUpdatedTelemetry(`fallback:${reason}`);
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryGateDenial(reason: string) {
  updateState({
    gateDenials: activeRideCanaryStabilityState.gateDenials + 1,
    lastGateDenialAt: nowIso(),
  });
  emitUpdatedTelemetry(`gate-denied:${reason}`);
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryMappingFailure(reason: string) {
  updateState({
    mappingFailures: activeRideCanaryStabilityState.mappingFailures + 1,
    lastMappingFailureAt: nowIso(),
  });
  emitUpdatedTelemetry(`mapping-failure:${reason}`);
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryStaleProjection(reason: string) {
  updateState({
    staleProjectionIncidents: activeRideCanaryStabilityState.staleProjectionIncidents + 1,
    lastStaleProjectionAt: nowIso(),
  });
  emitUpdatedTelemetry(`stale-projection:${reason}`);
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryComparisonMismatch() {
  updateState({
    comparisonMismatches: activeRideCanaryStabilityState.comparisonMismatches + 1,
    lastMismatchAt: nowIso(),
  });
  emitUpdatedTelemetry('comparison-mismatch');
  return getActiveRideCanaryStabilitySnapshot();
}

export function recordActiveRideCanaryRollback(reason: string) {
  updateState({
    rollbackEvents: activeRideCanaryStabilityState.rollbackEvents + 1,
    lastRollbackAt: nowIso(),
  });
  emitRideActiveRideCanaryRollbackRecordedTelemetry({ reason });
  emitUpdatedTelemetry(`rollback:${reason}`);
  return getActiveRideCanaryStabilitySnapshot();
}

export function getActiveRideCanaryStabilitySnapshot(): ActiveRideCanaryStabilitySnapshot {
  const snapshot = { ...activeRideCanaryStabilityState };
  const observationWindowMs = msBetween(snapshot.startedAt, snapshot.lastUpdatedAt);
  const totalFallbackEvaluations = snapshot.projectedSourceSelections + snapshot.liveFallbacks;
  const fallbackRate = totalFallbackEvaluations > 0 ? snapshot.liveFallbacks / totalFallbackEvaluations : 1;
  const timeSinceLastMismatchMs = durationSince(snapshot.lastMismatchAt);
  const timeSinceLastFallbackMs = durationSince(snapshot.lastFallbackAt);
  const ready = computeReadiness(snapshot, DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS);

  return {
    ...snapshot,
    observationWindowMs,
    fallbackRate,
    timeSinceLastMismatchMs,
    timeSinceLastFallbackMs,
    ready,
    reason: ready ? 'ready' : buildDeniedReason(snapshot, observationWindowMs, fallbackRate),
  };
}

function buildDeniedReason(
  snapshot: ActiveRideCanaryStabilityState,
  observationWindowMs: number,
  fallbackRate: number,
) {
  if (snapshot.rollbackEvents > 0) return 'rollback-recorded';
  if (snapshot.mappingFailures > 0) return 'mapping-failure-detected';
  if (snapshot.staleProjectionIncidents > 0) return 'stale-projection-detected';
  if (snapshot.comparisonMismatches > 0) return 'mismatch-detected';
  if (snapshot.projectedSourceSelections < DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads) {
    return 'projected-reads-too-low';
  }
  if (observationWindowMs < DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumObservationWindowMs) {
    return 'observation-window-too-short';
  }
  if (fallbackRate > DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.maximumFallbackRate) {
    return 'fallback-rate-too-high';
  }
  return 'not-ready';
}

function computeReadiness(
  snapshot: ActiveRideCanaryStabilityState,
  thresholds: ActiveRideCanaryStabilityThresholds,
) {
  const observationWindowMs = msBetween(snapshot.startedAt, snapshot.lastUpdatedAt);
  const totalFallbackEvaluations = snapshot.projectedSourceSelections + snapshot.liveFallbacks;
  const fallbackRate = totalFallbackEvaluations > 0 ? snapshot.liveFallbacks / totalFallbackEvaluations : 1;

  return (
    snapshot.projectedSourceSelections >= thresholds.minimumSuccessfulProjectedReads
    && observationWindowMs >= thresholds.minimumObservationWindowMs
    && snapshot.mappingFailures === 0
    && snapshot.staleProjectionIncidents === 0
    && snapshot.comparisonMismatches === 0
    && fallbackRate <= thresholds.maximumFallbackRate
    && snapshot.rollbackEvents === 0
  );
}

export function isReadyForNextActiveRideSurface(
  snapshot: ActiveRideCanaryStabilityState = activeRideCanaryStabilityState,
  thresholds: ActiveRideCanaryStabilityThresholds = DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS,
) {
  const observationWindowMs = msBetween(snapshot.startedAt, snapshot.lastUpdatedAt);
  const totalFallbackEvaluations = snapshot.projectedSourceSelections + snapshot.liveFallbacks;
  const fallbackRate = totalFallbackEvaluations > 0 ? snapshot.liveFallbacks / totalFallbackEvaluations : 1;
  const ready = computeReadiness(snapshot, thresholds);

  const telemetry = {
    ready,
    projectedSourceSelections: snapshot.projectedSourceSelections,
    liveFallbacks: snapshot.liveFallbacks,
    gateDenials: snapshot.gateDenials,
    mappingFailures: snapshot.mappingFailures,
    staleProjectionIncidents: snapshot.staleProjectionIncidents,
    comparisonMismatches: snapshot.comparisonMismatches,
    rollbackEvents: snapshot.rollbackEvents,
    observationWindowMs,
    fallbackRate,
  };

  if (ready) {
    emitRideActiveRideCanaryStabilityApprovedTelemetry(telemetry);
  } else {
    emitRideActiveRideCanaryStabilityDeniedTelemetry(telemetry);
  }

  return ready;
}

export function seedActiveRideCanaryStabilityForTests(seed: Partial<ActiveRideCanaryStabilityState>) {
  Object.assign(activeRideCanaryStabilityState, seed);
}

export function resetActiveRideCanaryStabilityForTests() {
  activeRideCanaryStabilityState.projectedSourceSelections = 0;
  activeRideCanaryStabilityState.liveFallbacks = 0;
  activeRideCanaryStabilityState.gateDenials = 0;
  activeRideCanaryStabilityState.mappingFailures = 0;
  activeRideCanaryStabilityState.staleProjectionIncidents = 0;
  activeRideCanaryStabilityState.comparisonMismatches = 0;
  activeRideCanaryStabilityState.rollbackEvents = 0;
  activeRideCanaryStabilityState.startedAt = null;
  activeRideCanaryStabilityState.lastUpdatedAt = null;
  activeRideCanaryStabilityState.lastMismatchAt = null;
  activeRideCanaryStabilityState.lastFallbackAt = null;
  activeRideCanaryStabilityState.lastProjectedSelectionAt = null;
  activeRideCanaryStabilityState.lastGateDenialAt = null;
  activeRideCanaryStabilityState.lastMappingFailureAt = null;
  activeRideCanaryStabilityState.lastStaleProjectionAt = null;
  activeRideCanaryStabilityState.lastRollbackAt = null;
  return getActiveRideCanaryStabilitySnapshot();
}
