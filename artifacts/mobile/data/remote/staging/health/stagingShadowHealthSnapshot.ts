import {
  getStagingShadowHealthReport,
} from './stagingShadowHealthReport';
import {
  evaluateStagingShadowHealth,
  stagingShadowHealthPolicies,
} from './stagingShadowHealthPolicies';
import type {
  StagingShadowDomainHealth,
  StagingShadowHealthRecommendation,
  StagingShadowHealthReport,
  StagingShadowHealthStatus,
} from './stagingShadowHealthTypes';

export interface StagingShadowHealthSnapshotDomain {
  domain: string;
  status: StagingShadowHealthStatus;
  recommendation: StagingShadowHealthRecommendation;
  score: number | null;
  attempts: number;
  successRate: number;
  failureRate: number;
  mismatchRate: number;
  timeoutRate: number;
  blockedReason: string | null;
  lastMismatchCategory: string | null;
  lastErrorCategory: string | null;
  lastUpdatedAt: string | null;
}

export interface StagingShadowHealthSnapshot {
  generatedAt: string;
  domainsIncluded: string[];
  domains: StagingShadowHealthSnapshotDomain[];
  blockers: string[];
  warnings: string[];
  metricsSummary: {
    domainsTotal: number;
    domainsWithData: number;
    totalAttempts: number;
    totalSuccesses: number;
    totalFailures: number;
    totalTimeouts: number;
    totalMismatches: number;
    averageLatencyMs: number;
  };
  overallStatus: StagingShadowHealthStatus;
  overallRecommendation: StagingShadowHealthRecommendation;
  overallScore: number | null;
}

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreDomain(domain: StagingShadowDomainHealth) {
  if (domain.shadowAttempts === 0) return null;

  const penalty =
    (domain.failureRate * 50) +
    (domain.mismatchRate * 30) +
    (domain.timeoutRate * 20);

  return clampScore(100 - penalty);
}

function summarizeDomain(domain: StagingShadowDomainHealth): StagingShadowHealthSnapshotDomain {
  const evaluation = evaluateStagingShadowHealth({
    blocked: domain.blocked,
    shadowAttempts: domain.shadowAttempts,
    shadowSuccesses: domain.shadowSuccesses,
    shadowFailures: domain.shadowFailures,
    timeouts: domain.timeouts,
    semanticMismatches: domain.semanticMismatches,
    shapeMismatches: domain.shapeMismatches,
    policies: stagingShadowHealthPolicies,
  });

  return {
    domain: domain.domain,
    status: domain.status,
    recommendation: domain.recommendation,
    score: scoreDomain(domain),
    attempts: domain.shadowAttempts,
    successRate: evaluation.successRate,
    failureRate: evaluation.failureRate,
    mismatchRate: evaluation.mismatchRate,
    timeoutRate: evaluation.timeoutRate,
    blockedReason: domain.blockedReason,
    lastMismatchCategory: domain.lastMismatchCategory,
    lastErrorCategory: domain.lastErrorCategory,
    lastUpdatedAt: domain.lastUpdatedAt,
  };
}

function evaluateOverallStatus(domains: StagingShadowHealthSnapshotDomain[]): StagingShadowHealthStatus {
  if (domains.some(domain => domain.status === 'blocked')) return 'blocked';
  if (domains.some(domain => domain.status === 'failing')) return 'failing';
  if (domains.every(domain => domain.status === 'idle')) return 'idle';
  if (domains.some(domain => domain.status === 'degraded')) return 'degraded';
  return 'healthy';
}

function evaluateOverallRecommendation(domains: StagingShadowHealthSnapshotDomain[]): StagingShadowHealthRecommendation {
  if (domains.some(domain => domain.status === 'blocked')) return 'blocked';
  if (domains.some(domain => domain.status === 'failing')) return 'investigate';
  if (domains.every(domain => domain.status === 'idle')) return 'collect_data';
  if (domains.every(domain => domain.recommendation === 'ready_for_hybrid_candidate')) {
    return 'ready_for_hybrid_candidate';
  }
  return 'continue_shadow';
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function createStagingShadowHealthSnapshot(report: StagingShadowHealthReport = getStagingShadowHealthReport()): StagingShadowHealthSnapshot {
  const domains = report.domains.map(summarizeDomain);
  const blockers = domains.flatMap(domain => {
    if (domain.status === 'blocked') {
      return [`${domain.domain}: ${domain.blockedReason ?? 'blocked'}`];
    }
    if (domain.status === 'failing') {
      return [`${domain.domain}: failing`];
    }
    return [];
  });
  const warnings = domains.flatMap(domain => {
    if (domain.status === 'degraded') return [`${domain.domain}: degraded`];
    if (domain.status === 'idle') return [`${domain.domain}: collect_data`];
    return [];
  });

  const totalAttempts = domains.reduce((sum, domain) => sum + domain.attempts, 0);
  const totalSuccesses = report.domains.reduce((sum, domain) => sum + domain.shadowSuccesses, 0);
  const totalFailures = report.domains.reduce((sum, domain) => sum + domain.shadowFailures, 0);
  const totalTimeouts = report.domains.reduce((sum, domain) => sum + domain.timeouts, 0);
  const totalMismatches = report.domains.reduce((sum, domain) => sum + domain.semanticMismatches + domain.shapeMismatches, 0);
  const averageLatencyMs = report.domains.length === 0
    ? 0
    : average(report.domains.map(domain => domain.averageLatencyMs));

  const overallStatus = evaluateOverallStatus(domains);
  const overallRecommendation = evaluateOverallRecommendation(domains);
  const overallScore = domains.some(domain => domain.score !== null)
    ? average(domains.flatMap(domain => (domain.score === null ? [] : [domain.score])))
    : null;

  return {
    generatedAt: nowIso(),
    domainsIncluded: domains.map(domain => domain.domain),
    domains,
    blockers,
    warnings,
    metricsSummary: {
      domainsTotal: domains.length,
      domainsWithData: domains.filter(domain => domain.attempts > 0).length,
      totalAttempts,
      totalSuccesses,
      totalFailures,
      totalTimeouts,
      totalMismatches,
      averageLatencyMs,
    },
    overallStatus,
    overallRecommendation,
    overallScore,
  };
}

export function formatStagingShadowHealthSnapshot(snapshot: StagingShadowHealthSnapshot = createStagingShadowHealthSnapshot()) {
  const report = getStagingShadowHealthReport();
  const lines = [
    'Staging Shadow Health Snapshot',
    `Generated at: ${snapshot.generatedAt}`,
    `Overall status: ${snapshot.overallStatus}`,
    `Overall recommendation: ${snapshot.overallRecommendation}`,
    `Domains included: ${snapshot.domainsIncluded.join(', ')}`,
    `Overall score: ${snapshot.overallScore === null ? 'n/a' : snapshot.overallScore}`,
    `Metrics: attempts=${snapshot.metricsSummary.totalAttempts} success=${snapshot.metricsSummary.totalSuccesses} failure=${snapshot.metricsSummary.totalFailures} timeout=${snapshot.metricsSummary.totalTimeouts} mismatch=${snapshot.metricsSummary.totalMismatches} avgLatencyMs=${snapshot.metricsSummary.averageLatencyMs}`,
  ];

  if (snapshot.blockers.length > 0) {
    lines.push('Blockers:');
    lines.push(...snapshot.blockers.map(blocker => `- ${blocker}`));
  }

  if (snapshot.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...snapshot.warnings.map(warning => `- ${warning}`));
  }

  lines.push('Domains:');
  lines.push(...snapshot.domains.map(domain => (
    `- ${domain.domain}: status=${domain.status} recommendation=${domain.recommendation} score=${domain.score === null ? 'n/a' : domain.score} attempts=${domain.attempts} successRate=${domain.successRate.toFixed(2)} failureRate=${domain.failureRate.toFixed(2)} mismatchRate=${domain.mismatchRate.toFixed(2)} timeoutRate=${domain.timeoutRate.toFixed(2)} lastUpdatedAt=${domain.lastUpdatedAt ?? 'n/a'}`
  )));

  if (report.domains.length === 0) {
    lines.push('No staging shadow data recorded yet.');
  }

  return lines.join('\n');
}

export function serializeStagingShadowHealthSnapshot(snapshot: StagingShadowHealthSnapshot = createStagingShadowHealthSnapshot()) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function evaluateStagingShadowHealthSnapshot(snapshot: StagingShadowHealthSnapshot, strict = false) {
  if (!strict) {
    return { shouldFail: false, exitCode: 0 };
  }

  const shouldFail = snapshot.overallStatus === 'blocked' || snapshot.overallStatus === 'failing';
  return {
    shouldFail,
    exitCode: shouldFail ? 1 : 0,
  };
}
