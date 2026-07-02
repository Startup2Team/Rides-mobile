import { useCallback, useMemo, useReducer } from 'react';
import { queryClient } from '@/query/client';
import { forceActiveRideLiveSource, getActiveRideRolloutStatus } from '../activeRideRolloutGate';
import { getCanaryHealthReport } from '../../canary/canaryReport';
import { getRideCanaryHealthSnapshot, resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import { getActiveRideCanaryReport, resetActiveRideCanaryReport, formatActiveRideCanaryReport } from '../activeRideCanaryReport';
import {
  getActiveRideCanaryStabilitySnapshot,
  recordActiveRideCanaryRollback,
  resetActiveRideCanaryStabilityForTests,
} from '../activeRideCanaryStability';

export type RideCanaryInspectorTone = 'healthy' | 'warning' | 'critical';

export interface RideCanaryInspectorSummary {
  label: string;
  status: string;
  projectedReads: number;
  liveReads: number;
  fallbacks: number;
  mismatches: number;
  staleEvents: number;
  mappingFailures: number;
  rollbackCount: number;
  readiness: string;
  recommendation: string;
  tone: RideCanaryInspectorTone;
}

export interface RideCanaryInspectorSnapshot {
  visible: boolean;
  history: RideCanaryInspectorSummary;
  detail: RideCanaryInspectorSummary;
  activeRide: RideCanaryInspectorSummary;
  readiness: {
    historyReady: boolean;
    detailReady: boolean;
    activeReady: boolean;
  };
  rolloutGate: ReturnType<typeof getActiveRideRolloutStatus>;
  stability: ReturnType<typeof getActiveRideCanaryStabilitySnapshot>;
  report: ReturnType<typeof getActiveRideCanaryReport>;
  monitoringReport: string;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function isRideCanaryInspectorVisible() {
  if (isProduction()) return false;
  if (process.env.NODE_ENV === 'test') return true;
  if (typeof globalThis !== 'undefined' && (globalThis as { __DEV__?: boolean }).__DEV__) return true;
  return process.env.ENABLE_RIDE_CANARY_INSPECTOR === 'true';
}

function toTone({
  recommendation,
  readiness,
  status,
}: {
  recommendation: string;
  readiness: string;
  status: string;
}): RideCanaryInspectorTone {
  if (recommendation === 'rollback' || status === 'unhealthy' || readiness === 'blocked') return 'critical';
  if (recommendation === 'investigate' || recommendation === 'hold' || readiness === 'warning' || status === 'degraded') {
    return 'warning';
  }
  return 'healthy';
}

function summarizeHistoryOrDetail(
  label: 'History' | 'Ride Detail',
  report: ReturnType<typeof getCanaryHealthReport>['canaries']['history'],
  state: ReturnType<typeof getRideCanaryHealthSnapshot>['history' | 'detail'],
): RideCanaryInspectorSummary {
  const projectedReads = state.comparisons;
  const liveReads = state.liveFallbacks + state.projectionUnavailable;
  const recommendation =
    report.currentStatus === 'healthy'
      ? 'ready_for_next_surface'
      : state.mappingFailures > 0 || state.mismatches > 0 || state.liveFallbacks > 0
        ? 'investigate'
        : state.comparisons === 0
          ? 'hold'
          : 'hold';
  const readiness = report.currentStatus === 'healthy' ? 'ready' : 'blocked';

  return {
    label,
    status: report.currentStatus,
    projectedReads,
    liveReads,
    fallbacks: state.liveFallbacks,
    mismatches: state.mismatches,
    staleEvents: 0,
    mappingFailures: state.mappingFailures,
    rollbackCount: 0,
    readiness,
    recommendation,
    tone: toTone({ recommendation, readiness, status: report.currentStatus }),
  };
}

function summarizeActiveRide(
  report: ReturnType<typeof getActiveRideCanaryReport>,
  stability: ReturnType<typeof getActiveRideCanaryStabilitySnapshot>,
  rolloutGate: ReturnType<typeof getActiveRideRolloutStatus>,
): RideCanaryInspectorSummary {
  const projectedReads = stability.projectedSourceSelections;
  const liveReads = stability.liveFallbacks;
  const readiness = report.readinessForNextSurface ? 'ready' : 'blocked';

  return {
    label: 'Active Ride',
    status: report.stabilityStatus,
    projectedReads,
    liveReads,
    fallbacks: stability.liveFallbacks,
    mismatches: stability.comparisonMismatches,
    staleEvents: stability.staleProjectionIncidents,
    mappingFailures: stability.mappingFailures,
    rollbackCount: stability.rollbackEvents,
    readiness,
    recommendation: report.recommendedAction,
    tone: toTone({
      recommendation: report.recommendedAction,
      readiness,
      status: report.stabilityStatus,
    }),
  };
}

export function createRideCanaryInspectorSnapshot(): RideCanaryInspectorSnapshot {
  const health = getCanaryHealthReport();
  const snapshot = getRideCanaryHealthSnapshot();
  const stability = getActiveRideCanaryStabilitySnapshot();
  const report = getActiveRideCanaryReport();
  const rolloutGate = getActiveRideRolloutStatus();

  return {
    visible: isRideCanaryInspectorVisible(),
    history: summarizeHistoryOrDetail('History', health.canaries.history, snapshot.history),
    detail: summarizeHistoryOrDetail('Ride Detail', health.canaries.detail, snapshot.detail),
    activeRide: summarizeActiveRide(report, stability, rolloutGate),
    readiness: {
      historyReady: health.canaries.history.currentStatus === 'healthy',
      detailReady: health.canaries.detail.currentStatus === 'healthy',
      activeReady: report.readinessForNextSurface,
    },
    rolloutGate,
    stability,
    report,
    monitoringReport: formatActiveRideCanaryReport(report),
  };
}

function bumpReducer(state: number) {
  return state + 1;
}

export function useRideCanaryInspector() {
  const [revision, bump] = useReducer(bumpReducer, 0);

  const refresh = useCallback(() => {
    bump();
  }, []);

  const snapshot = useMemo(() => createRideCanaryInspectorSnapshot(), [revision]);

  const resetMetrics = useCallback(() => {
    resetRideCanaryHealthForTests();
    resetActiveRideCanaryStabilityForTests();
    resetActiveRideCanaryReport();
    refresh();
  }, [refresh]);

  const forceLive = useCallback(() => {
    try {
      forceActiveRideLiveSource('ride-canary-inspector');
    } finally {
      refresh();
    }
  }, [refresh]);

  const simulateRollback = useCallback(() => {
    try {
      recordActiveRideCanaryRollback('ride-canary-inspector');
    } finally {
      refresh();
    }
  }, [refresh]);

  const exportReport = useCallback(() => JSON.stringify({
    generatedAt: snapshot.report.generatedAt,
    history: snapshot.history,
    detail: snapshot.detail,
    activeRide: snapshot.activeRide,
    rolloutGate: snapshot.rolloutGate,
    stability: snapshot.stability,
    report: snapshot.report,
  }, null, 2), [snapshot]);

  const queryCacheSize = queryClient.getQueryCache().getAll().length;

  return {
    revision,
    visible: snapshot.visible,
    snapshot,
    queryCacheSize,
    refresh,
    resetMetrics,
    forceLive,
    simulateRollback,
    exportReport,
  };
}
