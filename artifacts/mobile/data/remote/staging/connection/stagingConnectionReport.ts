import type { StagingConnectionChecklistCategoryReport, StagingConnectionDomain, StagingConnectionReport } from './stagingConnectionTypes';
import { evaluateStagingConnectionChecklist, type StagingConnectionChecklistOptions } from './stagingConnectionChecklist';
import { stagingConnectionCategories } from './stagingConnectionPolicies';

export async function getStagingConnectionReport(options: StagingConnectionChecklistOptions = {}): Promise<StagingConnectionReport> {
  return evaluateStagingConnectionChecklist(options);
}

export async function getStagingConnectionBlockers(options: StagingConnectionChecklistOptions = {}) {
  const report = await getStagingConnectionReport(options);
  return report.criticalBlockers;
}

export async function getStagingConnectionPendingEvidence(options: StagingConnectionChecklistOptions = {}) {
  const report = await getStagingConnectionReport(options);
  return report.pendingEvidence;
}

export async function isReadyForRealStagingShadow(options: StagingConnectionChecklistOptions = {}) {
  const report = await getStagingConnectionReport(options);
  return report.overallStatus === 'ready_for_staging_shadow';
}

export function formatStagingConnectionReport(report: StagingConnectionReport) {
  const lines = [
    'Staging Backend Connection Checklist',
    `Generated at: ${report.generatedAt}`,
    `Overall status: ${report.overallStatus}`,
    `Recommended action: ${report.recommendedAction}`,
    `Manifest: ${report.manifestPath}`,
    `Evidence: ${report.evidencePath}`,
  ];

  if (report.criticalBlockers.length > 0) {
    lines.push('Critical blockers:');
    lines.push(...report.criticalBlockers.map(item => `- ${item}`));
  }

  if (report.pendingEvidence.length > 0) {
    lines.push('Pending evidence:');
    lines.push(...report.pendingEvidence.map(item => `- ${item}`));
  }

  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...report.warnings.map(item => `- ${item}`));
  }

  lines.push('Categories:');
  for (const category of stagingConnectionCategories) {
    const group = report.checklistCategories.find(item => item.category === category) as StagingConnectionChecklistCategoryReport | undefined;
    lines.push(`- ${category}: ${group?.items.length ?? 0} items`);
    if (group) {
      for (const item of group.items) {
        lines.push(`  - ${item.key}: ${item.status} (${item.severity}) ${item.details}`);
      }
    }
  }

  lines.push('Domains:');
  for (const domain of report.domains) {
    lines.push(`- ${domain.domain}: contract=${domain.contract.passed ? 'passed' : 'blocked'} readiness=${domain.readiness}`);
    if (domain.contract.missingOperations.length > 0) {
      lines.push(`  missing: ${domain.contract.missingOperations.join(', ')}`);
    }
    if (domain.contract.contractBlockers.length > 0) {
      lines.push(`  contract blockers: ${domain.contract.contractBlockers.join(' | ')}`);
    }
    if (domain.contract.warnings.length > 0) {
      lines.push(`  contract warnings: ${domain.contract.warnings.join(' | ')}`);
    }
    if (domain.blockers.length > 0) {
      lines.push(`  blockers: ${domain.blockers.join(' | ')}`);
    }
    if (domain.warnings.length > 0) {
      lines.push(`  warnings: ${domain.warnings.join(' | ')}`);
    }
  }

  if (report.domainContractStatus.length > 0) {
    lines.push('Domain contract status:');
    for (const contract of report.domainContractStatus) {
      lines.push(`- ${contract.domain}: passed=${contract.passed} missing=${contract.missingOperations.length} blockers=${contract.contractBlockers.length}`);
    }
  }

  return lines.join('\n');
}
