import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { repositoryResolver } from '../../adapters';
import { getRemoteProductionGuardAudit } from '../remoteReadinessReport';
import {
  evaluateHybridCandidate,
  formatHybridCandidateReviewReport,
  getDefaultHybridCandidateApprovalFilePath,
  getDefaultHybridCandidateBaselinePath,
  getHybridCandidateReviewReport,
} from '../hybridCandidateGate';
import { recordStagingShadowEvent, resetStagingShadowHealth } from '../../staging/health';

const cliPath = path.resolve(__dirname, '../../../../scripts/review-hybrid-candidates.js');
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
    recordStagingShadowEvent({ domain, operation, event: 'shadow_success', latencyMs: 10 });
  }
}

describe('hybrid candidate gate', () => {
  beforeEach(() => {
    resetState();
    jest.restoreAllMocks();
  });

  test('default domains are not approved', () => {
    const report = getHybridCandidateReviewReport();

    expect(report.domains.map(domain => domain.domain)).toEqual(['savedLocations', 'profile']);
    expect(report.domains.every(domain => domain.status === 'not_reviewed')).toBe(true);
    expect(report.domains.every(domain => domain.approved === false)).toBe(true);
    expect(report.overallStatus).toBe('not_reviewed');
  });

  test('missing health data blocks approval', () => {
    const approvalFile = writeJson(fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-candidate-')), 'approvals.json', {
      savedLocations: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'placeholder',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
      profile: {
        approved: true,
        approvedBy: 'reviewer',
        approvedAt: '2026-07-04T00:00:00.000Z',
        reason: 'placeholder',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
    });

    const report = evaluateHybridCandidate('savedLocations', {
      approvalFilePath: approvalFile,
      baselinePath,
    });

    expect(report.status).toBe('blocked');
    expect(report.approved).toBe(true);
    expect(report.blockers).toEqual(expect.arrayContaining(['approved candidate is missing staging shadow evidence']));
  });

  test('passing metrics but no human approval needs review', () => {
    seedReadyShadowData('savedLocations');

    const report = evaluateHybridCandidate('savedLocations', {
      approvalFilePath: approvalPath,
      baselinePath,
      productionGuardAudit: getRemoteProductionGuardAudit(),
    });

    expect(report.stagingHealthRecommendation).toBe('ready_for_hybrid_candidate');
    expect(report.status).toBe('needs_human_review');
    expect(report.approved).toBe(false);
  });

  test('explicit approval with passing evidence is approved for hybrid candidate', () => {
    seedReadyShadowData('profile');

    const approvalFile = writeJson(fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-candidate-')), 'approvals.json', {
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
        reason: 'low-risk profile staging evidence',
        expiresAt: '2026-08-04T00:00:00.000Z',
      },
    });

    const report = evaluateHybridCandidate('profile', {
      approvalFilePath: approvalFile,
      baselinePath,
    });

    expect(report.status).toBe('approved_for_hybrid_candidate');
    expect(report.approved).toBe(true);
    expect(report.blockers).toHaveLength(0);
  });

  test('expired approval is blocked', () => {
    seedReadyShadowData('profile');

    const approvalFile = writeJson(fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-candidate-')), 'approvals.json', {
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
        approvedAt: '2026-07-01T00:00:00.000Z',
        reason: 'expired review',
        expiresAt: '2026-07-02T00:00:00.000Z',
      },
    });

    const report = evaluateHybridCandidate('profile', {
      approvalFilePath: approvalFile,
      baselinePath,
      now: new Date('2026-07-04T00:00:00.000Z'),
    });

    expect(report.status).toBe('blocked');
    expect(report.approvalExpired).toBe(true);
  });

  test('production guard violation is blocked', () => {
    seedReadyShadowData('savedLocations');
    const report = evaluateHybridCandidate('savedLocations', {
      baselinePath,
      productionGuardAudit: {
        passed: false,
        findings: [{ name: 'repository-resolver-default-local', passed: false, details: 'forced failure' }],
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.productionGuardPassed).toBe(false);
  });

  test('strict mode fails invalid approval', () => {
    const approvalFile = writeJson(fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-candidate-')), 'approvals.json', {
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

    const report = getHybridCandidateReviewReport({
      approvalFilePath: approvalFile,
      baselinePath,
      productionGuardAudit: getRemoteProductionGuardAudit(),
    });

    expect(report.strictViolations).toEqual(expect.arrayContaining(['savedLocations: approved without required evidence']));
  });

  test('cli strict mode exits non-zero for invalid approval', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrid-candidate-cli-'));
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

    expect(() => execFileSync(process.execPath, [cliPath, '--strict'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HYBRID_CANDIDATE_APPROVAL_FILE: approvalFile,
        HYBRID_CANDIDATE_BASELINE_FILE: baselinePath,
      },
    })).toThrow();
  });

  test('cli json output works', () => {
    const output = execFileSync(process.execPath, [cliPath, '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(output);

    expect(parsed.domains.map((domain: { domain: string }) => domain.domain)).toEqual(['savedLocations', 'profile']);
    expect(parsed.overallStatus).toBe('not_reviewed');
  });

  test('repository resolver default remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });

  test('formatting includes both domains', () => {
    const report = getHybridCandidateReviewReport();
    const output = formatHybridCandidateReviewReport(report);

    expect(output).toContain('HYBRID Candidate Review Gate');
    expect(output).toContain('savedLocations');
    expect(output).toContain('profile');
  });
});
