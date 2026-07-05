import fs from 'fs';
import path from 'path';
import {
  getDefaultHybridCandidateApprovalFilePath,
  getDefaultHybridCandidateBaselinePath,
  getHybridCandidateDomains,
  getHybridCandidateReviewReport,
  type HybridCandidateApprovalRecord,
  type HybridCandidateDomain,
  type HybridCandidateReviewReport,
} from './hybridCandidateGate';
import { defaultHybridDomainPolicy, type HybridRollbackReason, type HybridRolloutStage } from './hybridRolloutPolicy';
import type { RemoteProductionGuardAudit, RemoteReadinessRiskCategory } from './remoteReadinessTypes';
import type { StagingShadowHealthRecommendation, StagingShadowHealthStatus } from '../staging/health';
import type { StagingShadowHealthSnapshot } from '../staging/health/stagingShadowHealthSnapshot';

export interface HybridDryRunEvidence {
  reviewApproved: boolean;
  stagingHealthReady: boolean;
  baselineComparisonPassed: boolean;
  productionGuardPassed: boolean;
  approvalExpired: boolean;
  rollbackPlanDocumented: boolean;
  writeShadowSafetyDocumented: boolean;
  telemetrySanitizationDocumented: boolean;
  lowRiskOrApproved: boolean;
}

export interface HybridDryRunDomainPlan {
  domain: HybridCandidateDomain;
  label: string;
  riskCategory: RemoteReadinessRiskCategory;
  reviewStatus: HybridCandidateReviewReport['domains'][number]['status'];
  stagingHealthStatus: StagingShadowHealthStatus;
  stagingHealthRecommendation: StagingShadowHealthRecommendation;
  readinessScore: number;
  readinessRecommendation: string;
  approved: boolean;
  approval: HybridCandidateApprovalRecord;
  approvalExpired: boolean;
  allowed: boolean;
  recommendedStage: HybridRolloutStage;
  rollbackReason: HybridRollbackReason;
  rollbackPlanSummary: string;
  blockers: string[];
  warnings: string[];
  evidence: HybridDryRunEvidence;
  strictViolations: string[];
}

export interface HybridDryRunPlanSummary {
  domainsTotal: number;
  domainsAllowed: number;
  domainsBlocked: number;
  domainsShadowRemoteRecommended: number;
  domainsHybridDryRunRecommended: number;
}

export interface HybridDryRunPlanReport {
  generatedAt: string;
  domainsIncluded: HybridCandidateDomain[];
  domains: HybridDryRunDomainPlan[];
  overallAllowed: boolean;
  overallRecommendedStage: HybridRolloutStage;
  blockers: string[];
  warnings: string[];
  strictViolations: string[];
  summary: HybridDryRunPlanSummary;
  productionGuardAudit: RemoteProductionGuardAudit;
  baselineComparison: HybridCandidateReviewReport['baselineComparison'];
  approvalFilePath: string;
  baselinePath: string;
}

export interface HybridDryRunEvaluatorOptions {
  domains?: HybridCandidateDomain[];
  approvalFilePath?: string;
  baselinePath?: string;
  currentSnapshot?: StagingShadowHealthSnapshot;
  productionGuardAudit?: RemoteProductionGuardAudit;
  now?: Date;
}

const repoRoot = path.resolve(__dirname, '../../../../..');
const defaultRolloutPlanPath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'hybrid-rollout-plan.md');
const evidenceFiles = [
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'staging-shadow-health.md'),
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'backend-integration-boundary.md'),
  path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'repositories.md'),
  defaultRolloutPlanPath,
];

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function readText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function loadDocumentEvidence() {
  const text = evidenceFiles.map(readText).join('\n');
  return {
    rollbackPlanDocumented: /rollback\s+to\s+LOCAL|rollback/i.test(text) && /LOCAL/i.test(text),
    writeShadowSafetyDocumented: /shadow writes default off|write shadow/i.test(text),
    telemetrySanitizationDocumented: /telemetry/i.test(text) && /sanitized|sanitised/i.test(text),
  };
}

function getSelectedDomains(options: HybridDryRunEvaluatorOptions) {
  return options.domains?.length ? options.domains : getHybridCandidateDomains();
}

function approvalExpired(approval: HybridCandidateApprovalRecord, now: Date) {
  if (!approval.approved || !approval.expiresAt) return false;
  const parsed = Date.parse(approval.expiresAt);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= now.getTime();
}

function summarizeRollbackReason(input: {
  approvalExpired: boolean;
  productionGuardPassed: boolean;
  baselineComparisonPassed: boolean;
  rollbackPlanDocumented: boolean;
  writeShadowSafetyDocumented: boolean;
}): HybridRollbackReason {
  if (input.approvalExpired) return 'rollback_due_to_expired_approval';
  if (!input.productionGuardPassed) return 'rollback_due_to_production_guard';
  if (!input.baselineComparisonPassed) return 'rollback_due_to_regression';
  if (!input.rollbackPlanDocumented || !input.writeShadowSafetyDocumented) return 'rollback_due_to_documentation_gap';
  return 'restore_local';
}

function recommendedStageForDomain(input: {
  reviewStatus: HybridDryRunDomainPlan['reviewStatus'];
  stagingHealthStatus: StagingShadowHealthStatus;
  stagingHealthRecommendation: StagingShadowHealthRecommendation;
  allowed: boolean;
  blockers: string[];
}): HybridRolloutStage {
  if (input.allowed) return 'hybrid_dry_run';
  if (input.blockers.length > 0) return 'disabled';
  if (input.reviewStatus === 'blocked') return 'disabled';
  if (input.stagingHealthRecommendation === 'collect_data' || input.stagingHealthStatus === 'idle') return 'disabled';
  return 'shadow_remote';
}

function buildDomainPlan(domain: HybridCandidateDomain, report: HybridCandidateReviewReport, options: HybridDryRunEvaluatorOptions): HybridDryRunDomainPlan {
  const review = report.domains.find(item => item.domain === domain);
  if (!review) {
    return {
      domain,
      label: domain,
      riskCategory: 'low',
      reviewStatus: 'not_reviewed',
      stagingHealthStatus: 'idle',
      stagingHealthRecommendation: 'collect_data',
      readinessScore: 0,
      readinessRecommendation: 'not_ready',
      approved: false,
      approval: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
      approvalExpired: false,
      allowed: false,
      recommendedStage: defaultHybridDomainPolicy.stage,
      rollbackReason: 'restore_local',
      rollbackPlanSummary: 'Rollback to LOCAL by keeping the repository resolver on LOCAL, preserving local-authoritative state, and leaving shadow diagnostics off.',
      blockers: [`${domain}: review data unavailable`],
      warnings: [`${domain}: review data unavailable`],
      evidence: {
        reviewApproved: false,
        stagingHealthReady: false,
        baselineComparisonPassed: !report.baselineComparison.strictRegressionDetected,
        productionGuardPassed: report.productionGuardAudit.passed,
        approvalExpired: false,
        rollbackPlanDocumented: false,
        writeShadowSafetyDocumented: false,
        telemetrySanitizationDocumented: false,
        lowRiskOrApproved: false,
      },
      strictViolations: [],
    };
  }

  const documentEvidence = loadDocumentEvidence();
  const productionGuardPassed = (options.productionGuardAudit ?? report.productionGuardAudit).passed;
  const baselineComparisonPassed = !report.baselineComparison.strictRegressionDetected;
  const approvalIsExpired = approvalExpired(review.approval, options.now ?? new Date());
  const evidence = {
    reviewApproved: review.approved,
    stagingHealthReady: review.stagingHealthRecommendation === 'ready_for_hybrid_candidate',
    baselineComparisonPassed,
    productionGuardPassed,
    approvalExpired: approvalIsExpired,
    rollbackPlanDocumented: documentEvidence.rollbackPlanDocumented,
    writeShadowSafetyDocumented: documentEvidence.writeShadowSafetyDocumented,
    telemetrySanitizationDocumented: documentEvidence.telemetrySanitizationDocumented,
    lowRiskOrApproved: review.riskCategory === 'low' || review.approved,
  };

  const blockers = [
    ...review.blockers,
    ...(approvalIsExpired ? ['approval expired'] : []),
    ...(!documentEvidence.rollbackPlanDocumented ? ['rollback plan is not documented'] : []),
    ...(!documentEvidence.writeShadowSafetyDocumented ? ['shadow write safety is not documented'] : []),
    ...(!documentEvidence.telemetrySanitizationDocumented ? ['telemetry sanitization is not documented'] : []),
    ...(!evidence.lowRiskOrApproved ? ['domain risk requires explicit approval'] : []),
    ...(!productionGuardPassed ? ['production guard failed'] : []),
    ...(!baselineComparisonPassed ? report.baselineComparison.regressions : []),
  ];

  const warnings = [
    ...review.warnings,
  ];

  const allowed =
    review.status === 'approved_for_hybrid_candidate' &&
    review.approved &&
    !approvalIsExpired &&
    productionGuardPassed &&
    baselineComparisonPassed &&
    documentEvidence.rollbackPlanDocumented &&
    documentEvidence.writeShadowSafetyDocumented &&
    documentEvidence.telemetrySanitizationDocumented &&
    evidence.lowRiskOrApproved;

  const recommendedStage = recommendedStageForDomain({
    reviewStatus: review.status,
    stagingHealthStatus: review.stagingHealthStatus,
    stagingHealthRecommendation: review.stagingHealthRecommendation,
    allowed,
    blockers,
  });

  const rollbackReason = summarizeRollbackReason({
    approvalExpired: approvalIsExpired,
    productionGuardPassed,
    baselineComparisonPassed,
    rollbackPlanDocumented: documentEvidence.rollbackPlanDocumented,
    writeShadowSafetyDocumented: documentEvidence.writeShadowSafetyDocumented,
  });

  const strictViolations: string[] = [];
  if (review.approval.approved && review.status !== 'approved_for_hybrid_candidate') {
    strictViolations.push(`${domain}: approved domain is not ready for hybrid dry run`);
  }
  if (review.approval.approved && approvalIsExpired) {
    strictViolations.push(`${domain}: approval expired`);
  }
  if (review.approval.approved && !allowed) {
    strictViolations.push(`${domain}: approval claims readiness but evidence is missing or blocked`);
  }

  return {
    domain,
    label: review.label,
    riskCategory: review.riskCategory,
    reviewStatus: review.status,
    stagingHealthStatus: review.stagingHealthStatus,
    stagingHealthRecommendation: review.stagingHealthRecommendation,
    readinessScore: review.readinessScore,
    readinessRecommendation: review.readinessRecommendation,
    approved: review.approved,
    approval: review.approval,
    approvalExpired: approvalIsExpired,
    allowed,
    recommendedStage,
    rollbackReason,
    rollbackPlanSummary: 'Rollback to LOCAL by clearing HYBRID rollout flags, keeping the repository resolver on LOCAL, and preserving local-authoritative state while staging shadow stays diagnostics-only.',
    blockers,
    warnings,
    evidence,
    strictViolations,
  };
}

export function evaluateHybridDryRun(domain: HybridCandidateDomain, options: HybridDryRunEvaluatorOptions = {}) {
  const report = getHybridCandidateReviewReport({
    approvalFilePath: options.approvalFilePath ?? getDefaultHybridCandidateApprovalFilePath(),
    baselinePath: options.baselinePath ?? getDefaultHybridCandidateBaselinePath(),
    currentSnapshot: options.currentSnapshot,
    productionGuardAudit: options.productionGuardAudit,
    now: options.now,
  });

  return buildDomainPlan(domain, report, options);
}

export function evaluateAllHybridDryRuns(options: HybridDryRunEvaluatorOptions = {}) {
  const report = getHybridCandidateReviewReport({
    approvalFilePath: options.approvalFilePath ?? getDefaultHybridCandidateApprovalFilePath(),
    baselinePath: options.baselinePath ?? getDefaultHybridCandidateBaselinePath(),
    currentSnapshot: options.currentSnapshot,
    productionGuardAudit: options.productionGuardAudit,
    now: options.now,
  });

  return getSelectedDomains(options).map(domain => buildDomainPlan(domain, report, options));
}

function summarizeOverallStage(domains: HybridDryRunDomainPlan[]): HybridRolloutStage {
  if (domains.length === 0) return 'disabled';
  if (domains.every(domain => domain.recommendedStage === 'hybrid_dry_run' && domain.allowed)) return 'hybrid_dry_run';
  if (domains.some(domain => domain.recommendedStage === 'shadow_remote')) return 'shadow_remote';
  return 'disabled';
}

export function getHybridDryRunPlanReport(options: HybridDryRunEvaluatorOptions = {}) {
  const report = getHybridCandidateReviewReport({
    approvalFilePath: options.approvalFilePath ?? getDefaultHybridCandidateApprovalFilePath(),
    baselinePath: options.baselinePath ?? getDefaultHybridCandidateBaselinePath(),
    currentSnapshot: options.currentSnapshot,
    productionGuardAudit: options.productionGuardAudit,
    now: options.now,
  });
  const domainsIncluded = getSelectedDomains(options);
  const domains = domainsIncluded.map(domain => buildDomainPlan(domain, report, options));
  const blockers = domains.flatMap(domain => domain.blockers.map(blocker => `${domain.domain}: ${blocker}`));
  const warnings = domains.flatMap(domain => domain.warnings.map(warning => `${domain.domain}: ${warning}`));
  const strictViolations = domains.flatMap(domain => domain.strictViolations);

  return {
    generatedAt: options.now ? nowIso(options.now) : report.generatedAt,
    domainsIncluded,
    domains,
    overallAllowed: domains.length > 0 && domains.every(domain => domain.allowed),
    overallRecommendedStage: summarizeOverallStage(domains),
    blockers,
    warnings,
    strictViolations,
    summary: {
      domainsTotal: domains.length,
      domainsAllowed: domains.filter(domain => domain.allowed).length,
      domainsBlocked: domains.filter(domain => domain.recommendedStage === 'disabled' && domain.blockers.length > 0).length,
      domainsShadowRemoteRecommended: domains.filter(domain => domain.recommendedStage === 'shadow_remote').length,
      domainsHybridDryRunRecommended: domains.filter(domain => domain.recommendedStage === 'hybrid_dry_run').length,
    },
    productionGuardAudit: report.productionGuardAudit,
    baselineComparison: report.baselineComparison,
    approvalFilePath: options.approvalFilePath ?? getDefaultHybridCandidateApprovalFilePath(),
    baselinePath: options.baselinePath ?? getDefaultHybridCandidateBaselinePath(),
  };
}

export function formatHybridDryRunPlanReport(report: ReturnType<typeof getHybridDryRunPlanReport> = getHybridDryRunPlanReport()) {
  const lines = [
    'HYBRID Rollout Dry-Run Plan',
    `Generated at: ${report.generatedAt}`,
    `Domains included: ${report.domainsIncluded.join(', ') || 'none'}`,
    `Overall allowed: ${report.overallAllowed}`,
    `Overall recommended stage: ${report.overallRecommendedStage}`,
    `Summary: total=${report.summary.domainsTotal} allowed=${report.summary.domainsAllowed} blocked=${report.summary.domainsBlocked} shadow_remote=${report.summary.domainsShadowRemoteRecommended} hybrid_dry_run=${report.summary.domainsHybridDryRunRecommended}`,
    `Approval file: ${report.approvalFilePath}`,
    `Baseline file: ${report.baselinePath}`,
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
    lines.push(`- ${domain.domain}: review=${domain.reviewStatus} allowed=${domain.allowed} stage=${domain.recommendedStage} risk=${domain.riskCategory} approval=${domain.approved} health=${domain.stagingHealthStatus}/${domain.stagingHealthRecommendation}`);
    if (domain.blockers.length > 0) {
      lines.push(`  blockers: ${domain.blockers.join(' | ')}`);
    }
    if (domain.warnings.length > 0) {
      lines.push(`  warnings: ${domain.warnings.join(' | ')}`);
    }
    lines.push(`  rollback: ${domain.rollbackPlanSummary}`);
  }

  return lines.join('\n');
}

export function serializeHybridDryRunPlanReport(report: ReturnType<typeof getHybridDryRunPlanReport> = getHybridDryRunPlanReport()) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function getDefaultHybridRolloutPlanPath() {
  return defaultRolloutPlanPath;
}

export { defaultHybridDomainPolicy };
export { getHybridCandidateDomains };
