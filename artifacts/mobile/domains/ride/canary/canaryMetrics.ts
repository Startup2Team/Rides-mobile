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
