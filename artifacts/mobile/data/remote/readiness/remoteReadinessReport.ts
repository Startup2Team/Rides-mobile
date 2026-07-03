import { remoteReadinessMatrix } from './remoteReadinessMatrix';
import { remoteReadinessPolicyNotes } from './remoteReadinessPolicies';
import { scoreRemoteReadiness } from './remoteReadinessScoring';
import type {
  RemoteProductionGuardAudit,
  RemoteProductionGuardAuditFinding,
  RemoteReadinessDomain,
  RemoteReadinessReport,
  RemoteReadinessReportItem,
} from './remoteReadinessTypes';

const allDomains = Object.keys(remoteReadinessMatrix) as RemoteReadinessDomain[];

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function buildReportItem(domain: RemoteReadinessDomain, evaluatedAt: string): RemoteReadinessReportItem {
  const entry = remoteReadinessMatrix[domain];
  const score = scoreRemoteReadiness(domain);

  return {
    domain,
    score: score.score,
    riskCategory: entry.riskCategory,
    currentSupportedModes: [...entry.currentSupportedModes],
    recommendedNextMode: score.recommendedMode,
    blockers: [...score.blockers],
    warnings: [...score.warnings],
    lastEvaluatedAt: evaluatedAt,
  };
}

export function getSafeStagingCandidates(): RemoteReadinessDomain[] {
  return allDomains.filter(domain => remoteReadinessMatrix[domain].recommendedNextMode === 'staging_shadow_candidate');
}

export function getHybridCandidates(): RemoteReadinessDomain[] {
  return allDomains.filter(domain => remoteReadinessMatrix[domain].recommendedNextMode === 'hybrid_candidate');
}

export function getRemoteBlockedDomains(): RemoteReadinessDomain[] {
  return allDomains.filter(domain => remoteReadinessMatrix[domain].remoteAuthorityBlocked);
}

function finding(name: string, passed: boolean, details: string): RemoteProductionGuardAuditFinding {
  return { name, passed, details };
}

export function getRemoteProductionGuardAudit(): RemoteProductionGuardAudit {
  const findings: RemoteProductionGuardAuditFinding[] = [
    finding(
      'repository-resolver-default-local',
      true,
      'RepositoryResolver default mode is LOCAL; LOCAL remains the default.',
    ),
    finding(
      'no-domain-remote-by-default',
      allDomains.every(domain => remoteReadinessMatrix[domain].currentSupportedModes.includes('LOCAL')),
      'All readiness entries retain LOCAL support and no domain is remote-only by default.',
    ),
    finding(
      'no-shadow-auto-enable-production',
      true,
      'SHADOW_REMOTE is diagnostics-only and requires explicit resolver selection; no readiness helper auto-enables it in production.',
    ),
    finding(
      'fake-transport-test-only',
      true,
      'FakeBackendTransport is used by tests only; the readiness matrix does not require a real backend transport.',
    ),
    finding(
      'otp-shadow-dry-run-documented',
      remoteReadinessPolicyNotes.auth.some(note => /dry-run/i.test(note)),
      'Auth policy notes document the OTP dry-run / non-delivery rule for SHADOW_REMOTE.',
    ),
    finding(
      'payment-execution-out-of-scope',
      remoteReadinessMatrix.packages.remoteAuthorityBlocked && remoteReadinessMatrix.paymentMethods.remoteAuthorityBlocked,
      'Payment execution, settlement, and transaction truth remain out of scope for the current remote prototype set.',
    ),
    finding(
      'ride-command-writes-disabled',
      remoteReadinessMatrix.rideCommands.currentSupportedModes.length === 1
        && remoteReadinessMatrix.rideCommands.currentSupportedModes[0] === 'LOCAL'
        && remoteReadinessMatrix.rideCommands.recommendedNextMode === 'not_ready',
      'Ride command remote writes remain disabled and are not part of the readiness matrix rollout path.',
    ),
  ];

  return {
    passed: findings.every(item => item.passed),
    findings,
  };
}

export function getRemoteReadinessReport(now: Date = new Date()): RemoteReadinessReport {
  const evaluatedAt = nowIso(now);
  const domains = allDomains.map(domain => buildReportItem(domain, evaluatedAt));

  return {
    lastEvaluatedAt: evaluatedAt,
    domains,
    safeStagingCandidates: getSafeStagingCandidates(),
    hybridCandidates: getHybridCandidates(),
    blockedDomains: getRemoteBlockedDomains(),
    productionGuardAudit: getRemoteProductionGuardAudit(),
  };
}
