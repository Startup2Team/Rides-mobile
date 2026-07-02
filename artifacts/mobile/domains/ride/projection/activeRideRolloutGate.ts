import { rideProjectionCoordinator } from './projectionCoordinator';
import { isReadyForActiveRideCanary } from '../canary/canaryHealth';
import {
  emitRideActiveRideHardRollbackTriggeredTelemetry,
  emitRideActiveRideProductionGuardBlockedTelemetry,
  emitRideActiveRideRolloutGateApprovedTelemetry,
  emitRideActiveRideRolloutGateDeniedTelemetry,
  emitRideActiveRideRolloutGateEvaluatedTelemetry,
  emitRideActiveRideSustainedParityWindowUpdatedTelemetry,
} from '../canary/canaryMetrics';
import { recordActiveRideCanaryRollback } from './activeRideCanaryStability';

export interface ActiveRideRolloutGateThresholds {
  minimumComparisonCount: number;
  minimumObservationWindowMs: number;
  maximumMismatchRate: number;
  maximumFallbackRate: number;
  maximumStalenessRate: number;
  maximumMappingFailureRate: number;
  maximumUnresolvedProjectionErrorRate: number;
}

export interface ActiveRideRolloutGateObservation {
  canaryEnabled: boolean;
  useProjectedRideReadModel: boolean;
  projectedAvailable: boolean;
  fallback: boolean;
  stale: boolean;
  matched: boolean;
  mappingFailure: boolean;
  unresolvedProjectionError: boolean;
  comparisonTimestamp: string | null;
}

export interface ActiveRideRolloutGateState {
  startedAt: string | null;
  lastUpdatedAt: string | null;
  comparisonCount: number;
  projectedAvailableCount: number;
  mismatchCount: number;
  fallbackCount: number;
  stalenessCount: number;
  mappingFailureCount: number;
  unresolvedProjectionErrorCount: number;
  disabled: boolean;
  forcedLive: boolean;
  lastReason: string;
  lastMatched: boolean;
  lastComparisonTimestamp: string | null;
}

export interface ActiveRideRolloutGateStatus {
  eligible: boolean;
  reason: string;
  canaryEnabled: boolean;
  useProjectedRideReadModel: boolean;
  productionGuardAllowed: boolean;
  healthReady: boolean;
  disabled: boolean;
  forcedLive: boolean;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  lastComparisonTimestamp: string | null;
  comparisonCount: number;
  projectedAvailableCount: number;
  mismatchCount: number;
  fallbackCount: number;
  stalenessCount: number;
  mappingFailureCount: number;
  unresolvedProjectionErrorCount: number;
  observationWindowMs: number;
  mismatchRate: number;
  fallbackRate: number;
  stalenessRate: number;
  mappingFailureRate: number;
  unresolvedProjectionErrorRate: number;
  projectedAvailabilityRate: number;
  thresholds: ActiveRideRolloutGateThresholds;
}

export const DEFAULT_ACTIVE_RIDE_ROLLOUT_GATE_THRESHOLDS: ActiveRideRolloutGateThresholds = {
  minimumComparisonCount: 25,
  minimumObservationWindowMs: 10 * 60 * 1000,
  maximumMismatchRate: 0,
  maximumFallbackRate: 0,
  maximumStalenessRate: 0,
  maximumMappingFailureRate: 0,
  maximumUnresolvedProjectionErrorRate: 0,
};

const activeRideRolloutGateState: ActiveRideRolloutGateState = {
  startedAt: null,
  lastUpdatedAt: null,
  comparisonCount: 0,
  projectedAvailableCount: 0,
  mismatchCount: 0,
  fallbackCount: 0,
  stalenessCount: 0,
  mappingFailureCount: 0,
  unresolvedProjectionErrorCount: 0,
  disabled: false,
  forcedLive: false,
  lastReason: 'not-evaluated',
  lastMatched: true,
  lastComparisonTimestamp: null,
};

function nowIso() {
  return new Date().toISOString();
}

function rate(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function observationWindowMs(startedAt: string | null, lastUpdatedAt: string | null) {
  if (!startedAt || !lastUpdatedAt) {
    return 0;
  }
  return Math.max(0, new Date(lastUpdatedAt).getTime() - new Date(startedAt).getTime());
}

function buildStatus(input: {
  canaryEnabled: boolean;
  useProjectedRideReadModel: boolean;
  productionGuardAllowed: boolean;
  healthReady: boolean;
  reason?: string;
}): ActiveRideRolloutGateStatus {
  const thresholds = DEFAULT_ACTIVE_RIDE_ROLLOUT_GATE_THRESHOLDS;
  const windowMs = observationWindowMs(activeRideRolloutGateState.startedAt, activeRideRolloutGateState.lastUpdatedAt);
  const comparisonCount = activeRideRolloutGateState.comparisonCount;
  const mismatchRate = rate(activeRideRolloutGateState.mismatchCount, comparisonCount);
  const fallbackRate = rate(activeRideRolloutGateState.fallbackCount, comparisonCount);
  const stalenessRate = rate(activeRideRolloutGateState.stalenessCount, comparisonCount);
  const mappingFailureRate = rate(activeRideRolloutGateState.mappingFailureCount, comparisonCount);
  const unresolvedProjectionErrorRate = rate(activeRideRolloutGateState.unresolvedProjectionErrorCount, comparisonCount);
  const projectedAvailabilityRate = rate(activeRideRolloutGateState.projectedAvailableCount, comparisonCount);

  let eligible = false;
  let reason = input.reason ?? 'not-evaluated';

  if (activeRideRolloutGateState.disabled || activeRideRolloutGateState.forcedLive) {
    reason = 'hard-rollback';
  } else if (!input.canaryEnabled || !input.useProjectedRideReadModel) {
    reason = 'feature-disabled';
  } else if (!input.healthReady) {
    reason = 'health-gate';
  } else if (!input.productionGuardAllowed) {
    reason = 'production-guard-blocked';
  } else if (comparisonCount < thresholds.minimumComparisonCount) {
    reason = 'comparison-count-too-low';
  } else if (windowMs < thresholds.minimumObservationWindowMs) {
    reason = 'observation-window-too-short';
  } else if (mismatchRate > thresholds.maximumMismatchRate) {
    reason = 'mismatch-rate-too-high';
  } else if (fallbackRate > thresholds.maximumFallbackRate) {
    reason = 'fallback-rate-too-high';
  } else if (stalenessRate > thresholds.maximumStalenessRate) {
    reason = 'staleness-rate-too-high';
  } else if (mappingFailureRate > thresholds.maximumMappingFailureRate || activeRideRolloutGateState.mappingFailureCount > 0) {
    reason = 'mapping-failure-detected';
  } else if (unresolvedProjectionErrorRate > thresholds.maximumUnresolvedProjectionErrorRate || activeRideRolloutGateState.unresolvedProjectionErrorCount > 0) {
    reason = 'unresolved-projection-error-detected';
  } else {
    eligible = true;
    reason = 'rollout-approved';
  }

  return {
    eligible,
    reason,
    canaryEnabled: input.canaryEnabled,
    useProjectedRideReadModel: input.useProjectedRideReadModel,
    productionGuardAllowed: input.productionGuardAllowed,
    healthReady: input.healthReady,
    disabled: activeRideRolloutGateState.disabled,
    forcedLive: activeRideRolloutGateState.forcedLive,
    startedAt: activeRideRolloutGateState.startedAt,
    lastUpdatedAt: activeRideRolloutGateState.lastUpdatedAt,
    lastComparisonTimestamp: activeRideRolloutGateState.lastComparisonTimestamp,
    comparisonCount,
    projectedAvailableCount: activeRideRolloutGateState.projectedAvailableCount,
    mismatchCount: activeRideRolloutGateState.mismatchCount,
    fallbackCount: activeRideRolloutGateState.fallbackCount,
    stalenessCount: activeRideRolloutGateState.stalenessCount,
    mappingFailureCount: activeRideRolloutGateState.mappingFailureCount,
    unresolvedProjectionErrorCount: activeRideRolloutGateState.unresolvedProjectionErrorCount,
    observationWindowMs: windowMs,
    mismatchRate,
    fallbackRate,
    stalenessRate,
    mappingFailureRate,
    unresolvedProjectionErrorRate,
    projectedAvailabilityRate,
    thresholds,
  };
}

function recordTelemetry(status: ActiveRideRolloutGateStatus) {
  emitRideActiveRideRolloutGateEvaluatedTelemetry({
    eligible: status.eligible,
    reason: status.reason,
  });

  if (status.productionGuardAllowed === false) {
    emitRideActiveRideProductionGuardBlockedTelemetry({
      reason: status.reason,
    });
  }

  if (status.eligible) {
    emitRideActiveRideRolloutGateApprovedTelemetry({
      reason: status.reason,
    });
  } else {
    emitRideActiveRideRolloutGateDeniedTelemetry({
      reason: status.reason,
    });
  }
}

export function evaluateActiveRideRolloutGate(
  observation: ActiveRideRolloutGateObservation,
): ActiveRideRolloutGateStatus {
  const productionGuardAllowed = process.env.ALLOW_PROJECTED_ACTIVE_RIDE_UI === 'true';
  const healthReady = isReadyForActiveRideCanary();

  if (!observation.canaryEnabled || !observation.useProjectedRideReadModel) {
    const status = buildStatus({
      canaryEnabled: observation.canaryEnabled,
      useProjectedRideReadModel: observation.useProjectedRideReadModel,
      productionGuardAllowed,
      healthReady,
      reason: 'feature-disabled',
    });
    recordTelemetry(status);
    return status;
  }

  if (!activeRideRolloutGateState.startedAt) {
    activeRideRolloutGateState.startedAt = observation.comparisonTimestamp ?? nowIso();
  }

  activeRideRolloutGateState.lastUpdatedAt = observation.comparisonTimestamp ?? nowIso();
  activeRideRolloutGateState.comparisonCount += 1;
  activeRideRolloutGateState.projectedAvailableCount += observation.projectedAvailable ? 1 : 0;
  activeRideRolloutGateState.mismatchCount += observation.matched ? 0 : 1;
  activeRideRolloutGateState.fallbackCount += observation.fallback ? 1 : 0;
  activeRideRolloutGateState.stalenessCount += observation.stale ? 1 : 0;
  activeRideRolloutGateState.mappingFailureCount += observation.mappingFailure ? 1 : 0;
  activeRideRolloutGateState.unresolvedProjectionErrorCount += observation.unresolvedProjectionError ? 1 : 0;
  activeRideRolloutGateState.lastMatched = observation.matched;
  activeRideRolloutGateState.lastComparisonTimestamp = observation.comparisonTimestamp;

  const status = buildStatus({
    canaryEnabled: observation.canaryEnabled,
    useProjectedRideReadModel: observation.useProjectedRideReadModel,
    productionGuardAllowed,
    healthReady,
  });

  activeRideRolloutGateState.lastReason = status.reason;

  emitRideActiveRideSustainedParityWindowUpdatedTelemetry({
    comparisonCount: status.comparisonCount,
    mismatchCount: status.mismatchCount,
    fallbackCount: status.fallbackCount,
    stalenessCount: status.stalenessCount,
    mappingFailureCount: status.mappingFailureCount,
    unresolvedProjectionErrorCount: status.unresolvedProjectionErrorCount,
  });

  recordTelemetry(status);
  return status;
}

export function getActiveRideRolloutStatus(): ActiveRideRolloutGateStatus {
  const productionGuardAllowed = process.env.ALLOW_PROJECTED_ACTIVE_RIDE_UI === 'true';
  const healthReady = isReadyForActiveRideCanary();
  return buildStatus({
    canaryEnabled: process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY === 'true',
    useProjectedRideReadModel: process.env.USE_PROJECTED_RIDE_READ_MODEL === 'true',
    productionGuardAllowed,
    healthReady,
    reason: activeRideRolloutGateState.lastReason,
  });
}

export function disableProjectedActiveRide(reason = 'manual-disable') {
  activeRideRolloutGateState.disabled = true;
  activeRideRolloutGateState.lastReason = reason;
  recordActiveRideCanaryRollback(reason);
  emitRideActiveRideHardRollbackTriggeredTelemetry({ reason });
  return getActiveRideRolloutStatus();
}

export function forceActiveRideLiveSource(reason = 'manual-force-live') {
  activeRideRolloutGateState.disabled = true;
  activeRideRolloutGateState.forcedLive = true;
  activeRideRolloutGateState.lastReason = reason;
  recordActiveRideCanaryRollback(reason);
  rideProjectionCoordinator.rollbackToLive();
  emitRideActiveRideHardRollbackTriggeredTelemetry({ reason });
  return getActiveRideRolloutStatus();
}

export function seedActiveRideRolloutGateForTests(seed: Partial<ActiveRideRolloutGateState>) {
  Object.assign(activeRideRolloutGateState, seed);
}

export function resetActiveRideRolloutGateForTests() {
  activeRideRolloutGateState.startedAt = null;
  activeRideRolloutGateState.lastUpdatedAt = null;
  activeRideRolloutGateState.comparisonCount = 0;
  activeRideRolloutGateState.projectedAvailableCount = 0;
  activeRideRolloutGateState.mismatchCount = 0;
  activeRideRolloutGateState.fallbackCount = 0;
  activeRideRolloutGateState.stalenessCount = 0;
  activeRideRolloutGateState.mappingFailureCount = 0;
  activeRideRolloutGateState.unresolvedProjectionErrorCount = 0;
  activeRideRolloutGateState.disabled = false;
  activeRideRolloutGateState.forcedLive = false;
  activeRideRolloutGateState.lastReason = 'not-evaluated';
  activeRideRolloutGateState.lastMatched = true;
  activeRideRolloutGateState.lastComparisonTimestamp = null;
}
