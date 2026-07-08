import { observability } from '@/observability/context/observabilityContext';
import {
  DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS,
  type RideCanaryHealthReport,
  type RideCanaryHealthReportEntry,
  type RideCanaryHealthSnapshot,
  type RideCanaryHealthThresholds,
  type RideCanaryName,
} from './canaryTypes';
import { getRideCanaryHealthSnapshot, isReadyForActiveRideCanary } from './canaryHealth';

function summarizeCanary(
  canaryName: RideCanaryName,
  state: RideCanaryHealthSnapshot['history'],
  thresholds: RideCanaryHealthThresholds,
): RideCanaryHealthReportEntry {
  const comparisonCount = state.comparisons;
  const projectionOpportunities = comparisonCount + state.projectionUnavailable + state.mappingFailures;
  const successRate = comparisonCount === 0 ? 0 : state.matches / comparisonCount;
  const mismatchRate = comparisonCount === 0 ? 0 : state.mismatches / comparisonCount;
  const fallbackCount = state.liveFallbacks;
  const projectedAvailabilityRate = projectionOpportunities === 0 ? 0 : comparisonCount / projectionOpportunities;
  const currentStatus = comparisonCount === 0
    ? (state.projectionUnavailable > 0 || state.mappingFailures > 0 ? 'unhealthy' : 'unknown')
    : (
        state.mappingFailures > 0
        || mismatchRate > thresholds.maxMismatchRate
        || (projectionOpportunities === 0 ? 0 : fallbackCount / projectionOpportunities) > thresholds.maxFallbackRate
        || projectedAvailabilityRate < thresholds.minProjectedAvailabilityRate
        ? 'unhealthy'
        : (state.mismatches > 0 || state.liveFallbacks > 0 || state.projectionUnavailable > 0 ? 'degraded' : 'healthy')
      );

  return {
    canaryName,
    currentStatus,
    comparisonCount,
    successRate,
    mismatchRate,
    fallbackCount,
    mappingFailures: state.mappingFailures,
    projectionUnavailableCount: state.projectionUnavailable,
    projectedAvailabilityRate,
    lastMismatch: state.lastMismatch,
    lastFallback: state.lastFallback,
    lastComparisonTimestamp: state.lastComparisonTimestamp,
  };
}

export function getCanaryHealthReport(
  thresholds: RideCanaryHealthThresholds = DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS,
): RideCanaryHealthReport {
  const snapshot = getRideCanaryHealthSnapshot();
  const report: RideCanaryHealthReport = {
    generatedAt: new Date().toISOString(),
    thresholds,
    canaries: {
      history: summarizeCanary('history', snapshot.history, thresholds),
      detail: summarizeCanary('detail', snapshot.detail, thresholds),
    },
    activeRideCanaryReady: isReadyForActiveRideCanary(snapshot, thresholds),
    summary: {
      totalComparisons: snapshot.history.comparisons + snapshot.detail.comparisons,
      totalMatches: snapshot.history.matches + snapshot.detail.matches,
      totalMismatches: snapshot.history.mismatches + snapshot.detail.mismatches,
      totalFallbacks: snapshot.history.liveFallbacks + snapshot.detail.liveFallbacks,
      totalMappingFailures: snapshot.history.mappingFailures + snapshot.detail.mappingFailures,
    },
  };

  observability.logger.info('RideCanaryHealthReportGenerated', {
    activeRideCanaryReady: report.activeRideCanaryReady,
    totalComparisons: report.summary.totalComparisons,
  });

  return report;
}
