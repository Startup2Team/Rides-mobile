import { observability } from '@/observability/context/observabilityContext';
import type { RideCanaryFallbackRecord, RideCanaryName, RideCanaryParityAnalysis } from './canaryTypes';

function labelFor(canaryName: RideCanaryName) {
  return canaryName === 'history' ? 'RideHistory' : 'RideDetail';
}

export function emitRideCanaryComparisonTelemetry(analysis: RideCanaryParityAnalysis) {
  const label = labelFor(analysis.canaryName);
  const eventName = `${label}Parity${analysis.matched ? 'Success' : 'Mismatch'}`;
  observability.metrics.counter(`ride.canary.${analysis.canaryName}.comparison`, 1, {
    matched: String(analysis.matched),
  });
  observability.logger.info(eventName, {
    canaryName: analysis.canaryName,
    comparisonTimestamp: analysis.comparisonTimestamp,
    fieldDiffCount: analysis.fieldDiff.length,
  });
  if (!analysis.matched) {
    observability.metrics.counter(`ride.canary.${analysis.canaryName}.mismatch`, 1);
  }
}

export function emitRideCanaryFallbackTelemetry(record: RideCanaryFallbackRecord) {
  observability.metrics.counter(`ride.canary.${record.canaryName}.fallback`, 1, {
    reason: record.reason,
  });
  observability.logger.info('RideCanaryFallback', {
    canaryName: record.canaryName,
    reason: record.reason,
    fallbackTimestamp: record.fallbackTimestamp,
  });
}

export function emitRideCanaryAvailabilityTelemetry(record: { canaryName: RideCanaryName; available: boolean }) {
  observability.metrics.counter(`ride.canary.${record.canaryName}.availability`, 1, {
    available: String(record.available),
  });
  observability.logger.info('RideCanaryAvailabilityObserved', {
    canaryName: record.canaryName,
    available: record.available,
  });
}

export function emitRideCanaryMappingFailureTelemetry(record: { canaryName: RideCanaryName; reason: string; error?: unknown }) {
  observability.metrics.counter(`ride.canary.${record.canaryName}.mapping_failure`, 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideCanaryMappingFailure', {
    canaryName: record.canaryName,
    reason: record.reason,
    error: record.error instanceof Error ? record.error.message : record.error ?? null,
  });
}

export function emitRideCanaryReadinessTelemetry(record: { ready: boolean; reason: string }) {
  observability.metrics.counter('ride.canary.readiness.updated', 1, {
    ready: String(record.ready),
  });
  observability.logger.info('RideCanaryReadinessUpdated', {
    ready: record.ready,
    reason: record.reason,
  });
}

export function emitRideActiveRideComparisonTelemetry(record: { projectedAvailable: boolean; stale: boolean; reason: string | null }) {
  observability.metrics.counter('ride.active.comparison', 1, {
    projectedAvailable: String(record.projectedAvailable),
    stale: String(record.stale),
  });
  observability.logger.info('RideActiveRideComparison', record);
}

export function emitRideActiveRideMismatchTelemetry(record: { fieldDiffCount: number }) {
  observability.metrics.counter('ride.active.mismatch', 1);
  observability.logger.warn('RideActiveRideMismatch', record);
}

export function emitRideActiveRideFallbackTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.fallback', 1, { reason: record.reason });
  observability.logger.info('RideActiveRideFallback', record);
}

export function emitRideActiveRideProjectionStaleTelemetry(record: { reason: string; sequenceNumber: number; updatedAt: string }) {
  observability.metrics.counter('ride.active.projection_stale', 1, { reason: record.reason });
  observability.logger.warn('RideActiveRideProjectionStale', record);
}

export function emitRideActiveRideReadinessDeniedTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.canary.readiness_denied', 1, { reason: record.reason });
  observability.logger.info('RideActiveRideReadinessDenied', record);
}

export function emitRideActiveRideSourceSelectedTelemetry(record: { source: 'live' | 'projected' }) {
  observability.metrics.counter('ride.active.source_selected', 1, { source: record.source });
  observability.logger.info('RideActiveRideSourceSelected', record);
}

export function emitRideActiveRideMappingFailureTelemetry(record: { reason: string; error?: unknown }) {
  observability.metrics.counter('ride.active.mapping_failure', 1, { reason: record.reason });
  observability.logger.warn('RideActiveRideMappingFailure', {
    reason: record.reason,
    error: record.error instanceof Error ? record.error.message : record.error ?? null,
  });
}

export function emitRideActiveRideRolloutGateEvaluatedTelemetry(record: { eligible: boolean; reason: string }) {
  observability.metrics.counter('ride.active.rollout.gate.evaluated', 1, {
    eligible: String(record.eligible),
    reason: record.reason,
  });
  observability.logger.info('RideActiveRideRolloutGateEvaluated', record);
}

export function emitRideActiveRideRolloutGateApprovedTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.rollout.gate.approved', 1, {
    reason: record.reason,
  });
  observability.logger.info('RideActiveRideRolloutGateApproved', record);
}

export function emitRideActiveRideRolloutGateDeniedTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.rollout.gate.denied', 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideActiveRideRolloutGateDenied', record);
}

export function emitRideActiveRideHardRollbackTriggeredTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.rollout.hard_rollback', 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideActiveRideHardRollbackTriggered', record);
}

export function emitRideActiveRideProductionGuardBlockedTelemetry(record: { reason: string }) {
  observability.metrics.counter('ride.active.rollout.production_guard_blocked', 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideActiveRideProductionGuardBlocked', record);
}

export function emitRideActiveRideSustainedParityWindowUpdatedTelemetry(record: {
  comparisonCount: number;
  mismatchCount: number;
  fallbackCount: number;
  stalenessCount: number;
  mappingFailureCount: number;
  unresolvedProjectionErrorCount: number;
}) {
  observability.metrics.counter('ride.active.rollout.window_updated', 1, {
    comparisonCount: String(record.comparisonCount),
    mismatchCount: String(record.mismatchCount),
    fallbackCount: String(record.fallbackCount),
    stalenessCount: String(record.stalenessCount),
    mappingFailureCount: String(record.mappingFailureCount),
    unresolvedProjectionErrorCount: String(record.unresolvedProjectionErrorCount),
  });
  observability.logger.info('RideActiveRideSustainedParityWindowUpdated', record);
}

export function emitRideActiveRideUiSourceSelectedTelemetry(record: {
  source: 'live' | 'projected';
  reason: string;
}) {
  observability.metrics.counter('ride.active.ui.source_selected', 1, {
    source: record.source,
    reason: record.reason,
  });
  observability.logger.info('RideActiveRideUiSourceSelected', record);
}

export function emitRideActiveRideUiProjectedEnabledTelemetry(record: {
  source: 'projected';
  reason: string;
}) {
  observability.metrics.counter('ride.active.ui.projected_enabled', 1, {
    reason: record.reason,
  });
  observability.logger.info('RideActiveRideUiProjectedEnabled', record);
}

export function emitRideActiveRideUiLiveFallbackTelemetry(record: {
  reason: string;
}) {
  observability.metrics.counter('ride.active.ui.live_fallback', 1, {
    reason: record.reason,
  });
  observability.logger.info('RideActiveRideUiLiveFallback', record);
}

export function emitRideActiveRideUiRollbackUsedTelemetry(record: {
  reason: string;
}) {
  observability.metrics.counter('ride.active.ui.rollback_used', 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideActiveRideUiRollbackUsed', record);
}

export function emitRideActiveRideUiProjectionBlockedByGateTelemetry(record: {
  reason: string;
}) {
  observability.metrics.counter('ride.active.ui.projection_blocked_by_gate', 1, {
    reason: record.reason,
  });
  observability.logger.warn('RideActiveRideUiProjectionBlockedByGate', record);
}
