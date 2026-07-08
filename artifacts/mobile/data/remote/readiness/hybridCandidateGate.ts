import fs from 'fs';
import path from 'path';
import { remoteReadinessMatrix } from './remoteReadinessMatrix';
import { scoreRemoteReadiness } from './remoteReadinessScoring';
import { getRemoteProductionGuardAudit } from './remoteReadinessReport';
import { createStagingShadowHealthSnapshot, getStagingShadowHealthReport } from '../staging/health';
import type { RemoteProductionGuardAudit, RemoteReadinessDomain, RemoteReadinessRiskCategory } from './remoteReadinessTypes';
import type { StagingShadowHealthSnapshot } from '../staging/health/stagingShadowHealthSnapshot';
import type { StagingShadowHealthReport } from '../staging/health/stagingShadowHealthTypes';
import type { StagingShadowHealthRecommendation, StagingShadowHealthStatus } from '../staging/health';

export type HybridCandidateDomain = 'savedLocations' | 'profile';

export type HybridCandidateStatus =
  | 'not_reviewed'
  | 'blocked'
  | 'needs_more_shadow_data'
  | 'needs_human_review'
  | 'approved_for_hybrid_candidate';

export interface HybridCandidateApprovalRecord {
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  expiresAt: string | null;
}

export interface HybridCandidateApprovalFile {
  savedLocations: HybridCandidateApprovalRecord;
  profile: HybridCandidateApprovalRecord;
}

export interface HybridCandidateEvidenceStatus {
  remoteReadinessMatrix: boolean;
  stagingShadowHealth: boolean;
  baselineComparison: boolean;
  productionGuard: boolean;
  shadowWriteSafetyDocumented: boolean;
  rollbackPathDocumented: boolean;
  telemetrySanitizationDocumented: boolean;
  lowRiskOrApproved: boolean;
}

export interface HybridCandidateDomainReview {
  domain: HybridCandidateDomain;
  label: string;
  riskCategory: RemoteReadinessRiskCategory;
  status: HybridCandidateStatus;
  blockers: string[];
  warnings: string[];
  evidence: HybridCandidateEvidenceStatus;
  readinessScore: number;
  readinessRecommendation: string;
  stagingHealthStatus: StagingShadowHealthStatus;
  stagingHealthRecommendation: StagingShadowHealthRecommendation;
  stagingShadowAttempts: number;
  approval: HybridCandidateApprovalRecord;
  approved: boolean;
  approvalExpired: boolean;
  strictRegressionDetected: boolean;
  productionGuardPassed: boolean;
}

export interface HybridCandidateReviewSummary {
  domainsTotal: number;
  approvedForHybridCandidate: number;
  blocked: number;
  needsMoreShadowData: number;
  needsHumanReview: number;
  notReviewed: number;
}

export interface HybridCandidateReviewReport {
  generatedAt: string;
  repositoryResolverMode: string;
  domains: HybridCandidateDomainReview[];
  overallStatus: HybridCandidateStatus;
  blockers: string[];
  warnings: string[];
  summary: HybridCandidateReviewSummary;
  productionGuardAudit: RemoteProductionGuardAudit;
  baselineComparison: {
    strictRegressionDetected: boolean;
    regressions: string[];
    warnings: string[];
  };
  strictViolations: string[];
}

export interface HybridCandidateEvaluationOptions {
  approvalFilePath?: string;
  baselinePath?: string;
  currentSnapshot?: StagingShadowHealthSnapshot;
  currentReport?: StagingShadowHealthReport;
  productionGuardAudit?: RemoteProductionGuardAudit;
  now?: Date;
}

const repoRoot = path.resolve(__dirname, '../../../../..');
const defaultApprovalFilePath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'approvals', 'hybrid-candidates.json');
const defaultBaselinePath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'baselines', 'staging-health-baseline.json');
const compareScriptPath = path.join(repoRoot, 'artifacts', 'mobile', 'scripts', 'compare-staging-health.js');
const evidenceFiles = [
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'staging-shadow-health.md'),
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'backend-integration-boundary.md'),
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'repositories.md'),
];

const hybridCandidateDomains: HybridCandidateDomain[] = ['savedLocations', 'profile'];

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function normalizeApprovalRecord(record: Partial<HybridCandidateApprovalRecord> | undefined): HybridCandidateApprovalRecord {
  return {
    approved: Boolean(record?.approved),
    approvedBy: record?.approvedBy?.trim() || null,
    approvedAt: record?.approvedAt?.trim() || null,
    reason: record?.reason?.trim() || null,
    expiresAt: record?.expiresAt?.trim() || null,
  };
}

function defaultApprovalFile(): HybridCandidateApprovalFile {
  return {
    savedLocations: normalizeApprovalRecord({ approved: false }),
    profile: normalizeApprovalRecord({ approved: false }),
  };
}

function loadApprovalFile(filePath: string = defaultApprovalFilePath) {
  const parsed = readJsonFile<Partial<HybridCandidateApprovalFile>>(filePath);
  const fallback = defaultApprovalFile();

  return {
    filePath,
    exists: fs.existsSync(filePath),
    value: {
      savedLocations: normalizeApprovalRecord(parsed?.savedLocations ?? fallback.savedLocations),
      profile: normalizeApprovalRecord(parsed?.profile ?? fallback.profile),
    },
  };
}

function loadBaselineSnapshot(filePath: string = defaultBaselinePath) {
  return readJsonFile<Record<string, unknown>>(filePath);
}

function loadCompareModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(compareScriptPath) as {
    compareSnapshots: (
      current: Record<string, unknown>,
      baseline: Record<string, unknown>,
      options?: { scoreDropThreshold?: number },
    ) => { warnings: string[]; regressions: string[]; hasRegression: boolean };
  };
}

function loadDocumentEvidence() {
  const text = evidenceFiles
    .map(filePath => {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');

  return {
    shadowWriteSafetyDocumented: /shadow writes default off|write shadow/i.test(text),
    rollbackPathDocumented: /rollback path|rollback/i.test(text),
    telemetrySanitizationDocumented: /telemetry/i.test(text) && /sanitized|sanitised/i.test(text),
  };
}

function getDomainHealth(domain: HybridCandidateDomain) {
  const report = createStagingShadowHealthSnapshot(getStagingShadowHealthReport());
  return report.domains.find(item => item.domain === domain) ?? null;
}

function approvalExpired(approval: HybridCandidateApprovalRecord, now: Date) {
  if (!approval.approved || !approval.expiresAt) return false;
  const parsed = Date.parse(approval.expiresAt);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= now.getTime();
}

function evaluateStatus(input: {
  hasHardBlockers: boolean;
  shadowAttempts: number;
  metricsReady: boolean;
  approval: HybridCandidateApprovalRecord;
  approvalExpired: boolean;
}) {
  if (input.hasHardBlockers || input.approvalExpired) return 'blocked';
  if (input.approval.approved && input.shadowAttempts === 0) return 'blocked';
  if (input.shadowAttempts === 0) return 'not_reviewed';
  if (!input.metricsReady) return 'needs_more_shadow_data';
  if (!input.approval.approved) return 'needs_human_review';
  return 'approved_for_hybrid_candidate';
}

function compareAgainstBaseline(currentSnapshot: StagingShadowHealthSnapshot, baselinePath: string) {
  const compareModule = loadCompareModule();
  const baselineSnapshot = loadBaselineSnapshot(baselinePath);
  if (!baselineSnapshot) {
    return {
      strictRegressionDetected: true,
      regressions: ['baseline snapshot unavailable'],
      warnings: ['baseline snapshot unavailable'],
    };
  }

  const comparison = compareModule.compareSnapshots(currentSnapshot as unknown as Record<string, unknown>, baselineSnapshot, {});
  return {
    strictRegressionDetected: comparison.hasRegression,
    regressions: comparison.regressions,
    warnings: comparison.warnings,
  };
}

function buildDomainReview(
  domain: HybridCandidateDomain,
  options: HybridCandidateEvaluationOptions = {},
): HybridCandidateDomainReview {
  const entry = remoteReadinessMatrix[domain];
  const readiness = scoreRemoteReadiness(domain as RemoteReadinessDomain);
  const approvalFile = loadApprovalFile(options.approvalFilePath);
  const approval = approvalFile.value[domain];
  const now = options.now ?? new Date();
  const currentSnapshot = options.currentSnapshot ?? createStagingShadowHealthSnapshot(options.currentReport ?? getStagingShadowHealthReport());
  const baselineComparison = compareAgainstBaseline(currentSnapshot, options.baselinePath ?? defaultBaselinePath);
  const productionGuardAudit = options.productionGuardAudit ?? getRemoteProductionGuardAudit();
  const documentEvidence = loadDocumentEvidence();
  const health = getDomainHealth(domain);
  const shadowAttempts = health?.attempts ?? 0;
  const shadowRecommendation = health?.recommendation ?? 'collect_data';
  const metricsReady =
    readiness.recommendedMode === 'hybrid_candidate' &&
    shadowRecommendation === 'ready_for_hybrid_candidate' &&
    !baselineComparison.strictRegressionDetected &&
    productionGuardAudit.passed &&
    documentEvidence.shadowWriteSafetyDocumented &&
    documentEvidence.rollbackPathDocumented &&
    documentEvidence.telemetrySanitizationDocumented;

  const blockers = [
    ...(readiness.recommendedMode !== 'hybrid_candidate' ? ['remote readiness matrix does not recommend hybrid_candidate'] : []),
    ...(baselineComparison.strictRegressionDetected ? baselineComparison.regressions : []),
    ...(!productionGuardAudit.passed ? ['production guard failed'] : []),
    ...(!documentEvidence.shadowWriteSafetyDocumented ? ['shadow write safety is not documented'] : []),
    ...(!documentEvidence.rollbackPathDocumented ? ['rollback path is not documented'] : []),
    ...(!documentEvidence.telemetrySanitizationDocumented ? ['telemetry sanitization is not documented'] : []),
    ...(approval.approved && shadowAttempts === 0 ? ['approved candidate is missing staging shadow evidence'] : []),
    ...(approvalExpired(approval, now) ? ['approval expired'] : []),
  ];

  const warnings = [
    ...baselineComparison.warnings,
    ...(approval.approved ? [] : ['domain has not been explicitly approved yet']),
    ...(shadowAttempts === 0
      ? ['no staging shadow data recorded yet']
      : shadowRecommendation !== 'ready_for_hybrid_candidate'
        ? ['staging shadow health does not yet recommend ready_for_hybrid_candidate']
        : []),
  ];

  const status = evaluateStatus({
    hasHardBlockers: blockers.length > 0,
    shadowAttempts,
    metricsReady,
    approval,
    approvalExpired: approvalExpired(approval, now),
  });

  return {
    domain,
    label: entry.label,
    riskCategory: entry.riskCategory,
    status,
    blockers,
    warnings,
    evidence: {
      remoteReadinessMatrix: readiness.recommendedMode === 'hybrid_candidate',
      stagingShadowHealth: shadowRecommendation === 'ready_for_hybrid_candidate',
      baselineComparison: !baselineComparison.strictRegressionDetected,
      productionGuard: productionGuardAudit.passed,
      shadowWriteSafetyDocumented: documentEvidence.shadowWriteSafetyDocumented,
      rollbackPathDocumented: documentEvidence.rollbackPathDocumented,
      telemetrySanitizationDocumented: documentEvidence.telemetrySanitizationDocumented,
      lowRiskOrApproved: entry.riskCategory === 'low' || approval.approved,
    },
    readinessScore: readiness.score,
    readinessRecommendation: readiness.recommendedMode,
    stagingHealthStatus: health?.status ?? 'idle',
    stagingHealthRecommendation: shadowRecommendation,
    stagingShadowAttempts: shadowAttempts,
    approval,
    approved: approval.approved,
    approvalExpired: approvalExpired(approval, now),
    strictRegressionDetected: baselineComparison.strictRegressionDetected,
    productionGuardPassed: productionGuardAudit.passed,
  };
}

export function evaluateHybridCandidate(domain: HybridCandidateDomain, options: HybridCandidateEvaluationOptions = {}) {
  return buildDomainReview(domain, options);
}

export function evaluateAllHybridCandidates(options: HybridCandidateEvaluationOptions = {}) {
  return hybridCandidateDomains.map(domain => evaluateHybridCandidate(domain, options));
}

function summarizeOverallStatus(domains: HybridCandidateDomainReview[]): HybridCandidateStatus {
  if (domains.some(domain => domain.status === 'blocked')) return 'blocked';
  if (domains.some(domain => domain.status === 'needs_more_shadow_data')) return 'needs_more_shadow_data';
  if (domains.some(domain => domain.status === 'needs_human_review')) return 'needs_human_review';
  if (domains.length > 0 && domains.every(domain => domain.status === 'approved_for_hybrid_candidate')) return 'approved_for_hybrid_candidate';
  return 'not_reviewed';
}

export function getHybridCandidateReviewReport(options: HybridCandidateEvaluationOptions = {}): HybridCandidateReviewReport {
  const domains = evaluateAllHybridCandidates(options);
  const currentSnapshot = options.currentSnapshot ?? createStagingShadowHealthSnapshot(options.currentReport ?? getStagingShadowHealthReport());
  const baselineComparison = compareAgainstBaseline(currentSnapshot, options.baselinePath ?? defaultBaselinePath);
  const productionGuardAudit = options.productionGuardAudit ?? getRemoteProductionGuardAudit();

  const strictViolations = [
    ...(productionGuardAudit.passed ? [] : ['production guard failed']),
    ...(baselineComparison.strictRegressionDetected ? baselineComparison.regressions.map(regression => `baseline regression: ${regression}`) : []),
    ...domains.flatMap(domain => {
      const violations: string[] = [];
      if (domain.approval.approved && domain.status !== 'approved_for_hybrid_candidate') {
        violations.push(`${domain.domain}: approved without required evidence`);
      }
      if (domain.approvalExpired) {
        violations.push(`${domain.domain}: approval expired`);
      }
      if (domain.status === 'blocked') {
        violations.push(`${domain.domain}: blocked`);
      }
      return violations;
    }),
  ];

    return {
    generatedAt: nowIso(options.now ?? new Date()),
    repositoryResolverMode: 'LOCAL',
    domains,
    overallStatus: summarizeOverallStatus(domains),
    blockers: domains.flatMap(domain => domain.blockers.map(blocker => `${domain.domain}: ${blocker}`)),
    warnings: domains.flatMap(domain => domain.warnings.map(warning => `${domain.domain}: ${warning}`)),
    summary: {
      domainsTotal: domains.length,
      approvedForHybridCandidate: domains.filter(domain => domain.status === 'approved_for_hybrid_candidate').length,
      blocked: domains.filter(domain => domain.status === 'blocked').length,
      needsMoreShadowData: domains.filter(domain => domain.status === 'needs_more_shadow_data').length,
      needsHumanReview: domains.filter(domain => domain.status === 'needs_human_review').length,
      notReviewed: domains.filter(domain => domain.status === 'not_reviewed').length,
    },
    productionGuardAudit,
    baselineComparison,
    strictViolations,
  };
}

export function formatHybridCandidateReviewReport(report: HybridCandidateReviewReport = getHybridCandidateReviewReport()) {
  const lines = [
    'HYBRID Candidate Review Gate',
    `Generated at: ${report.generatedAt}`,
    `RepositoryResolver mode: ${report.repositoryResolverMode}`,
    `Overall status: ${report.overallStatus}`,
    `Domains: ${report.summary.domainsTotal} approved=${report.summary.approvedForHybridCandidate} blocked=${report.summary.blocked} needs_more_shadow_data=${report.summary.needsMoreShadowData} needs_human_review=${report.summary.needsHumanReview} not_reviewed=${report.summary.notReviewed}`,
  ];

  if (report.blockers.length > 0) {
    lines.push('Blockers:');
    lines.push(...report.blockers.map(blocker => `- ${blocker}`));
  }

  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...report.warnings.map(warning => `- ${warning}`));
  }

  lines.push('Domains:');
  for (const domain of report.domains) {
    lines.push(
      `- ${domain.domain}: status=${domain.status} approved=${domain.approved} risk=${domain.riskCategory} readiness=${domain.readinessRecommendation} shadowHealth=${domain.stagingHealthRecommendation} attempts=${domain.stagingShadowAttempts}`,
    );
  }

  return lines.join('\n');
}

export function getDefaultHybridCandidateApprovalFilePath() {
  return defaultApprovalFilePath;
}

export function getDefaultHybridCandidateBaselinePath() {
  return defaultBaselinePath;
}

export function getHybridCandidateDomains() {
  return [...hybridCandidateDomains];
}
