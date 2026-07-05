import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const compareScriptPath = path.resolve(__dirname, '../../../../../scripts/compare-staging-health.js');
const baselinePath = path.resolve(__dirname, '../../../../../docs/baselines/staging-health-baseline.json');

function makeSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    generatedAt: '2026-07-04T00:00:00.000Z',
    domainsIncluded: ['profile', 'savedLocations'],
    domains: [
      {
        domain: 'profile',
        status: 'idle',
        recommendation: 'collect_data',
        score: null,
        attempts: 0,
        successRate: 0,
        failureRate: 0,
        mismatchRate: 0,
        timeoutRate: 0,
        blockedReason: null,
        lastMismatchCategory: null,
        lastErrorCategory: null,
        lastUpdatedAt: null,
      },
      {
        domain: 'savedLocations',
        status: 'idle',
        recommendation: 'collect_data',
        score: null,
        attempts: 0,
        successRate: 0,
        failureRate: 0,
        mismatchRate: 0,
        timeoutRate: 0,
        blockedReason: null,
        lastMismatchCategory: null,
        lastErrorCategory: null,
        lastUpdatedAt: null,
      },
    ],
    blockers: [],
    warnings: ['profile: collect_data', 'savedLocations: collect_data'],
    metricsSummary: {
      domainsTotal: 2,
      domainsWithData: 0,
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      totalMismatches: 0,
      averageLatencyMs: 0,
    },
    overallStatus: 'idle',
    overallRecommendation: 'collect_data',
    overallScore: null,
    ...overrides,
  };
}

function writeSnapshot(snapshot: ReturnType<typeof makeSnapshot>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-health-compare-'));
  const filePath = path.join(dir, 'snapshot.json');
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return filePath;
}

describe('staging health comparison', () => {
  test('comparison passes when reports match', () => {
    const currentPath = writeSnapshot(makeSnapshot());
    const output = execFileSync(process.execPath, [compareScriptPath, '--current', currentPath, '--baseline', baselinePath], {
      encoding: 'utf8',
    });

    expect(output).toContain('No differences detected.');
  });

  test('comparison warns but exits 0 in non-strict mode', () => {
    const currentPath = writeSnapshot(makeSnapshot({
      overallStatus: 'degraded',
      domains: [
        {
          domain: 'profile',
          status: 'degraded',
          recommendation: 'continue_shadow',
          score: 80,
          attempts: 3,
          successRate: 0.67,
          failureRate: 0.33,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
        {
          domain: 'savedLocations',
          status: 'idle',
          recommendation: 'collect_data',
          score: null,
          attempts: 0,
          successRate: 0,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: null,
        },
      ],
      warnings: ['profile: degraded'],
      overallRecommendation: 'continue_shadow',
      overallScore: 80,
    }));

    const output = execFileSync(process.execPath, [compareScriptPath, '--current', currentPath, '--baseline', baselinePath], {
      encoding: 'utf8',
    });

    expect(output).toContain('Differences:');
    expect(output).toContain('Non-strict mode: differences detected but exiting 0.');
  });

  test('strict mode fails on blocked or failing regression', () => {
    const currentPath = writeSnapshot(makeSnapshot({
      overallStatus: 'blocked',
      overallRecommendation: 'blocked',
      blockers: ['profile: production-shadow-disabled'],
      domains: [
        {
          domain: 'profile',
          status: 'blocked',
          recommendation: 'blocked',
          score: 10,
          attempts: 1,
          successRate: 0,
          failureRate: 1,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: 'production-shadow-disabled',
          lastMismatchCategory: null,
          lastErrorCategory: 'production-shadow-disabled',
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
        {
          domain: 'savedLocations',
          status: 'idle',
          recommendation: 'collect_data',
          score: null,
          attempts: 0,
          successRate: 0,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: null,
        },
      ],
      warnings: ['profile: blocked'],
      overallScore: 10,
    }));

    expect(() => execFileSync(process.execPath, [compareScriptPath, '--strict', '--current', currentPath, '--baseline', baselinePath], {
      encoding: 'utf8',
    })).toThrow();
  });

  test('score drop threshold works', () => {
    const baseline = makeSnapshot({
      overallStatus: 'healthy',
      overallRecommendation: 'continue_shadow',
      domains: [
        {
          domain: 'profile',
          status: 'healthy',
          recommendation: 'continue_shadow',
          score: 95,
          attempts: 5,
          successRate: 1,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
        {
          domain: 'savedLocations',
          status: 'healthy',
          recommendation: 'continue_shadow',
          score: 95,
          attempts: 5,
          successRate: 1,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
      ],
      warnings: [],
      metricsSummary: {
        domainsTotal: 2,
        domainsWithData: 2,
        totalAttempts: 10,
        totalSuccesses: 10,
        totalFailures: 0,
        totalTimeouts: 0,
        totalMismatches: 0,
        averageLatencyMs: 12,
      },
      overallScore: 95,
    });
    const current = makeSnapshot({
      overallStatus: 'healthy',
      overallRecommendation: 'continue_shadow',
      domains: [
        {
          domain: 'profile',
          status: 'healthy',
          recommendation: 'continue_shadow',
          score: 70,
          attempts: 5,
          successRate: 1,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
        {
          domain: 'savedLocations',
          status: 'healthy',
          recommendation: 'continue_shadow',
          score: 70,
          attempts: 5,
          successRate: 1,
          failureRate: 0,
          mismatchRate: 0,
          timeoutRate: 0,
          blockedReason: null,
          lastMismatchCategory: null,
          lastErrorCategory: null,
          lastUpdatedAt: '2026-07-04T00:00:00.000Z',
        },
      ],
      warnings: [],
      metricsSummary: {
        domainsTotal: 2,
        domainsWithData: 2,
        totalAttempts: 10,
        totalSuccesses: 10,
        totalFailures: 0,
        totalTimeouts: 0,
        totalMismatches: 0,
        averageLatencyMs: 12,
      },
      overallScore: 70,
    });

    const currentPath = writeSnapshot(current);
    const baselinePathTemp = writeSnapshot(baseline);
    expect(() => execFileSync(process.execPath, [compareScriptPath, '--strict', '--current', currentPath, '--baseline', baselinePathTemp], {
      encoding: 'utf8',
      env: { ...process.env, STAGING_HEALTH_SCORE_DROP_THRESHOLD: '10' },
    })).toThrow();
  });

  test('new blockers are detected', () => {
    const currentPath = writeSnapshot(makeSnapshot({
      blockers: ['profile: production-shadow-disabled'],
      overallStatus: 'blocked',
      overallRecommendation: 'blocked',
    }));

    expect(() => execFileSync(process.execPath, [compareScriptPath, '--strict', '--current', currentPath, '--baseline', baselinePath], {
      encoding: 'utf8',
    })).toThrow();
  });

  test('help output works', () => {
    const output = execFileSync(process.execPath, [compareScriptPath, '--help'], { encoding: 'utf8' });

    expect(output).toContain('Usage: pnpm run compare:staging-health');
    expect(output).toContain('--strict');
  });

  test('baseline contains no secrets backend urls tokens or phone numbers', () => {
    const content = fs.readFileSync(baselinePath, 'utf8');

    expect(content).not.toContain('https://');
    expect(content).not.toContain('http://');
    expect(content).not.toContain('pk.');
    expect(content).not.toContain('+250');
    expect(content).not.toContain('token');
    expect(content).not.toContain('password');
  });
});
