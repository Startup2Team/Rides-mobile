import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { repositoryResolver } from '../../adapters';
import {
  evaluateHybridDryRun,
  formatHybridDryRunPlanReport,
  getDefaultHybridRolloutPlanPath,
  getHybridDryRunPlanReport,
} from '../hybridDryRunEvaluator';
import { getDefaultHybridCandidateApprovalFilePath, getDefaultHybridCandidateBaselinePath } from '../hybridCandidateGate';
import { recordStagingShadowEvent, resetStagingShadowHealth } from '../../staging/health';

const cliPath = path.resolve(__dirname, '../../../../scripts/plan-hybrid-rollout.js');
const baselinePath = getDefaultHybridCandidateBaselinePath();
const approvalPath = getDefaultHybridCandidateApprovalFilePath();

function resetState() {
  resetStagingShadowHealth();
}

function writeJson(tempDir: string, fileName: string, value: unknown) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function seedReadyShadowData(domain: 'savedLocations' | 'profile') {
  const operation = domain === 'savedLocations' ? 'listSavedLocations' : 'getCurrentProfile';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    recordStagingShadowEvent({ domain, operation, event: 'shadow_attempted' });
    recordStagingShadowEvent({ domain, operation, event: 'shadow_success', latencyMs: 12 });
  }
}

describe('hybrid dry-run evaluator', () => {
  beforeEach(() => {
    resetState();
    jest.restoreAllMocks();
  });

  test('default plan is disabled', () => {
    const report = getHybridDryRunPlanReport();

    expect(report.domainsIncluded).toEqual(['savedLocations', 'profile']);
    expect(report.overallAllowed).toBe(false);
    expect(report.overallRecommendedStage).toBe('disabled');
    expect(report.domains.every(domain => domain.recommendedStage === 'disabled')).toBe(true);
  });

  test('saved locations and profile do not advance without approval', () => {
    seedReadyShadowData('savedLocations');
    seedReadyShadowData('profile');

    const report = getHybridDryRunPlanReport({
      approvalFilePath: approvalPath,
      baselinePath,
    });

    expect(report.domains.find(domain => domain.domain === 'savedLocations')?.allowed).toBe(false);
    expect(report.domains.find(domain => domain.domain === 'profile')?.allowed).toBe(false);
    expect(report.domains.some(domain => domain.recommendedStage === 'hybrid_dry_run')).toBe(false);
  });

  test('approved domain with evidence can recommend hybrid dry run', () => {
    seedReadyShadowData('profile');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-rollout-'));
    const approvalFile = writeJson(tempDir, 'approvals.json', {
      savedLocations: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
      profile: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'approved for dry run',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
    });

    const report = evaluateHybridDryRun('profile', {
      approvalFilePath: approvalFile,
      baselinePath,
    });

    expect(report.allowed).toBe(true);
    expect(report.recommendedStage).toBe('hybrid_dry_run');
    expect(report.strictViolations).toHaveLength(0);
  });

  test('expired approval blocks the plan', () => {
    seedReadyShadowData('savedLocations');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-rollout-'));
    const approvalFile = writeJson(tempDir, 'approvals.json', {
      savedLocations: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-01T00:00:00.000Z',
        reason: 'expired',
        expiresAt: '2026-07-02T00:00:00.000Z',
      },
      profile: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
    });

    const report = evaluateHybridDryRun('savedLocations', {
      approvalFilePath: approvalFile,
      baselinePath,
      now: new Date('2026-07-04T00:00:00.000Z'),
    });

    expect(report.allowed).toBe(false);
    expect(report.approvalExpired).toBe(true);
    expect(report.blockers).toEqual(expect.arrayContaining(['approval expired']));
  });

  test('production guard violation blocks the plan', () => {
    seedReadyShadowData('profile');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-rollout-'));
    const approvalFile = writeJson(tempDir, 'approvals.json', {
      savedLocations: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
      profile: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'approved for dry run',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
    });

    const report = evaluateHybridDryRun('profile', {
      approvalFilePath: approvalFile,
      baselinePath,
      productionGuardAudit: {
        passed: false,
        findings: [{ name: 'repository-resolver-default-local', passed: false, details: 'forced failure' }],
      },
    });

    expect(report.allowed).toBe(false);
    expect(report.blockers).toEqual(expect.arrayContaining(['production guard failed']));
  });

  test('strict mode fails invalid approval', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-rollout-'));
    const approvalFile = writeJson(tempDir, 'approvals.json', {
      savedLocations: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'missing evidence',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
      profile: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
    });

    const report = getHybridDryRunPlanReport({
      approvalFilePath: approvalFile,
      baselinePath,
    });

    expect(report.strictViolations).toEqual(expect.arrayContaining([
      'savedLocations: approval claims readiness but evidence is missing or blocked',
    ]));
  });

  test('cli json output works', () => {
    const output = execFileSync(process.execPath, [cliPath, '--all', '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(output);

    expect(parsed.domainsIncluded).toEqual(expect.arrayContaining(['savedLocations', 'profile']));
    expect(parsed.overallRecommendedStage).toBe('disabled');
  });

  test('cli strict mode exits non-zero for invalid approval', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-rollout-cli-'));
    const approvalFile = writeJson(tempDir, 'approvals.json', {
      savedLocations: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'missing evidence',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
      profile: {
        approved: false,
        approvedBy: null,
        approvedAt: null,
        reason: null,
        expiresAt: null,
      },
    });

    expect(() => execFileSync(process.execPath, [cliPath, '--domain', 'savedLocations', '--strict'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HYBRID_ROLLOUT_APPROVAL_FILE: approvalFile,
        HYBRID_ROLLOUT_BASELINE_FILE: baselinePath,
      },
    })).toThrow();
  });

  test('repository resolver default remains local and no HYBRID mode is enabled', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
    expect(getDefaultHybridRolloutPlanPath()).toContain(path.join('artifacts', 'mobile', 'docs', 'hybrid-rollout-plan.md'));
  });

  test('formatted output includes both domains', () => {
    const report = getHybridDryRunPlanReport();
    const output = formatHybridDryRunPlanReport(report);

    expect(output).toContain('HYBRID Rollout Dry-Run Plan');
    expect(output).toContain('savedLocations');
    expect(output).toContain('profile');
  });
});
