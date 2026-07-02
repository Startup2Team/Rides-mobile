import type { ActiveRideCanaryStabilitySnapshot } from './activeRideCanaryStability';
import {
  DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS,
  getActiveRideCanaryStabilitySnapshot,
} from './activeRideCanaryStability';

export type ActiveRideCanaryRecommendation =
  | 'hold'
  | 'investigate'
  | 'rollback'
  | 'ready_for_next_surface';

export type ActiveRideCanaryReportStabilityStatus =
  | 'unknown'
  | 'holding'
  | 'needs_attention'
  | 'ready';

export interface ActiveRideCanaryReport {
  generatedAt: string;
  projectedReadCount: number;
  liveFallbackCount: number;
  gateDenialCount: number;
  mappingFailureCount: number;
  staleProjectionCount: number;
  comparisonMismatchCount: number;
  rollbackEventCount: number;
  timeSinceLastMismatchMs: number | null;
  timeSinceLastFallbackMs: number | null;
  stabilityStatus: ActiveRideCanaryReportStabilityStatus;
  readinessForNextSurface: boolean;
  recommendedAction: ActiveRideCanaryRecommendation;
  observationWindowMs: number;
  fallbackRate: number;
  readyThresholds: typeof DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS;
}

let lastActiveRideCanaryReport: ActiveRideCanaryReport | null = null;

function nowIso() {
  return new Date().toISOString();
}

function computeReadiness(snapshot: ActiveRideCanaryStabilitySnapshot) {
  return snapshot.ready;
}

function detectSevereMismatch(snapshot: ActiveRideCanaryStabilitySnapshot) {
  const mismatchRate = snapshot.projectedSourceSelections > 0
    ? snapshot.comparisonMismatches / snapshot.projectedSourceSelections
    : 0;
  return snapshot.comparisonMismatches >= 3 || mismatchRate >= 0.5;
}

function determineRecommendation(snapshot: ActiveRideCanaryStabilitySnapshot): ActiveRideCanaryRecommendation {
  if (snapshot.rollbackEvents > 0 || detectSevereMismatch(snapshot)) {
    return 'rollback';
  }

  if (snapshot.mappingFailures > 0 || snapshot.staleProjectionIncidents > 0 || snapshot.comparisonMismatches > 0) {
    return 'investigate';
  }

  if (!snapshot.ready) {
    return 'hold';
  }

  return 'ready_for_next_surface';
}

function deriveStabilityStatus(
  snapshot: ActiveRideCanaryStabilitySnapshot,
  recommendation: ActiveRideCanaryRecommendation,
): ActiveRideCanaryReportStabilityStatus {
  if (recommendation === 'ready_for_next_surface') return 'ready';
  if (recommendation === 'rollback' || snapshot.mappingFailures > 0 || snapshot.staleProjectionIncidents > 0) {
    return 'needs_attention';
  }
  if (!snapshot.ready) return 'holding';
  return 'unknown';
}

export function getActiveRideCanaryReport(): ActiveRideCanaryReport {
  const snapshot = getActiveRideCanaryStabilitySnapshot();
  const recommendation = determineRecommendation(snapshot);
  const readinessForNextSurface = computeReadiness(snapshot);
  const report: ActiveRideCanaryReport = {
    generatedAt: nowIso(),
    projectedReadCount: snapshot.projectedSourceSelections,
    liveFallbackCount: snapshot.liveFallbacks,
    gateDenialCount: snapshot.gateDenials,
    mappingFailureCount: snapshot.mappingFailures,
    staleProjectionCount: snapshot.staleProjectionIncidents,
    comparisonMismatchCount: snapshot.comparisonMismatches,
    rollbackEventCount: snapshot.rollbackEvents,
    timeSinceLastMismatchMs: snapshot.timeSinceLastMismatchMs,
    timeSinceLastFallbackMs: snapshot.timeSinceLastFallbackMs,
    stabilityStatus: deriveStabilityStatus(snapshot, recommendation),
    readinessForNextSurface,
    recommendedAction: recommendation,
    observationWindowMs: snapshot.observationWindowMs,
    fallbackRate: snapshot.fallbackRate,
    readyThresholds: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS,
  };

  lastActiveRideCanaryReport = report;
  return report;
}

export function resetActiveRideCanaryReport() {
  lastActiveRideCanaryReport = null;
  return lastActiveRideCanaryReport;
}

export function formatActiveRideCanaryReport(report: ActiveRideCanaryReport = lastActiveRideCanaryReport ?? getActiveRideCanaryReport()) {
  return [
    `Active Ride Canary Report`,
    `generatedAt=${report.generatedAt}`,
    `projectedReadCount=${report.projectedReadCount}`,
    `liveFallbackCount=${report.liveFallbackCount}`,
    `gateDenialCount=${report.gateDenialCount}`,
    `mappingFailureCount=${report.mappingFailureCount}`,
    `staleProjectionCount=${report.staleProjectionCount}`,
    `comparisonMismatchCount=${report.comparisonMismatchCount}`,
    `rollbackEventCount=${report.rollbackEventCount}`,
    `timeSinceLastMismatchMs=${report.timeSinceLastMismatchMs ?? 'n/a'}`,
    `timeSinceLastFallbackMs=${report.timeSinceLastFallbackMs ?? 'n/a'}`,
    `stabilityStatus=${report.stabilityStatus}`,
    `readinessForNextSurface=${report.readinessForNextSurface}`,
    `recommendedAction=${report.recommendedAction}`,
    `observationWindowMs=${report.observationWindowMs}`,
    `fallbackRate=${report.fallbackRate}`,
  ].join('\n');
}
