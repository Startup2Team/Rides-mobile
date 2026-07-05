import { evaluateStagingShadowHealth, stagingShadowHealthPolicies } from './stagingShadowHealthPolicies';
import { getKnownStagingShadowDomains, getStagingShadowDomainState, resetStagingShadowHealthMetrics } from './stagingShadowHealthMetrics';
import type {
  StagingShadowDomain,
  StagingShadowDomainHealth,
  StagingShadowHealthEvent,
  StagingShadowHealthReport,
} from './stagingShadowHealthTypes';
import { recordStagingShadowEvent as recordMetricsEvent } from './stagingShadowHealthMetrics';

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function averageLatencyMs(state: ReturnType<typeof getStagingShadowDomainState>) {
  const sampledOperations = state.shadowSuccesses + state.shadowFailures + state.timeouts;
  if (sampledOperations <= 0) return 0;
  return Math.round(state.totalLatencyMs / sampledOperations);
}

function buildDomainReport(domain: StagingShadowDomain): StagingShadowDomainHealth {
  const state = getStagingShadowDomainState(domain);
  const evaluation = evaluateStagingShadowHealth({
    blocked: state.blocked,
    shadowAttempts: state.shadowAttempts,
    shadowSuccesses: state.shadowSuccesses,
    shadowFailures: state.shadowFailures,
    timeouts: state.timeouts,
    semanticMismatches: state.semanticMismatches,
    shapeMismatches: state.shapeMismatches,
    policies: stagingShadowHealthPolicies,
  });

  return {
    domain,
    ...state,
    status: evaluation.status,
    recommendation: evaluation.recommendation,
    attemptsForHealth: state.shadowAttempts,
    attemptsForRecommendation: state.shadowAttempts,
    averageLatencyMs: averageLatencyMs(state),
    failureRate: evaluation.failureRate,
    mismatchRate: evaluation.mismatchRate,
    timeoutRate: evaluation.timeoutRate,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

export function recordStagingShadowEvent(event: StagingShadowHealthEvent) {
  recordMetricsEvent(event);
}

export function getDomainStagingShadowHealth(domain: StagingShadowDomain): StagingShadowDomainHealth {
  return buildDomainReport(domain);
}

export function getStagingShadowHealthReport(): StagingShadowHealthReport {
  const domains = getKnownStagingShadowDomains().map(buildDomainReport);
  return {
    lastEvaluatedAt: nowIso(),
    domains,
  };
}

export function resetStagingShadowHealth() {
  resetStagingShadowHealthMetrics();
}

export function formatStagingShadowHealthReport(report: StagingShadowHealthReport = getStagingShadowHealthReport()) {
  const lines = [
    'Staging Shadow Health Report',
    `Last evaluated: ${report.lastEvaluatedAt}`,
  ];

  if (report.domains.length === 0) {
    lines.push('No staging shadow domains have recorded activity yet.');
  } else {
    for (const domain of report.domains) {
      lines.push(
        `${domain.domain}: status=${domain.status} recommendation=${domain.recommendation} attempts=${domain.shadowAttempts} success=${domain.shadowSuccesses} failure=${domain.shadowFailures} timeout=${domain.timeouts} mismatch=${domain.semanticMismatches + domain.shapeMismatches} avgLatencyMs=${domain.averageLatencyMs}`,
      );
    }
  }

  return lines.join('\n');
}
