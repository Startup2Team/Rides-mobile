import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  createStagingShadowHealthSnapshot,
  evaluateStagingShadowHealthSnapshot,
  formatStagingShadowHealthSnapshot,
  serializeStagingShadowHealthSnapshot,
} from '../stagingShadowHealthSnapshot';
import { recordStagingShadowEvent, resetStagingShadowHealth } from '..';

const scriptPath = path.resolve(__dirname, '../../../../../scripts/report-staging-shadow-health.js');

describe('staging shadow health snapshot', () => {
  beforeEach(() => {
    resetStagingShadowHealth();
  });

  test('includes savedLocations and profile with idle collect_data defaults', () => {
    const snapshot = createStagingShadowHealthSnapshot();

    expect(snapshot.domainsIncluded).toEqual(['profile', 'savedLocations']);
    expect(snapshot.overallStatus).toBe('idle');
    expect(snapshot.overallRecommendation).toBe('collect_data');
    expect(snapshot.domains.every(domain => domain.status === 'idle')).toBe(true);
    expect(snapshot.domains.every(domain => domain.recommendation === 'collect_data')).toBe(true);
  });

  test('formatted output includes domain rows', () => {
    const snapshot = createStagingShadowHealthSnapshot();
    const formatted = formatStagingShadowHealthSnapshot(snapshot);

    expect(formatted).toContain('Staging Shadow Health Snapshot');
    expect(formatted).toContain('savedLocations');
    expect(formatted).toContain('profile');
  });

  test('JSON serialization works', () => {
    const snapshot = createStagingShadowHealthSnapshot();
    const serialized = serializeStagingShadowHealthSnapshot(snapshot);

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).toContain('"domainsIncluded"');
  });

  test('strict evaluation fails on failing and blocked snapshots', () => {
    const failing = {
      generatedAt: new Date().toISOString(),
      domainsIncluded: ['profile'],
      domains: [],
      blockers: [],
      warnings: [],
      metricsSummary: {
        domainsTotal: 1,
        domainsWithData: 1,
        totalAttempts: 10,
        totalSuccesses: 0,
        totalFailures: 10,
        totalTimeouts: 0,
        totalMismatches: 0,
        averageLatencyMs: 0,
      },
      overallStatus: 'failing' as const,
      overallRecommendation: 'investigate' as const,
      overallScore: 0,
    };
    const blocked = { ...failing, overallStatus: 'blocked' as const, overallRecommendation: 'blocked' as const };

    expect(evaluateStagingShadowHealthSnapshot(failing, true)).toEqual({ shouldFail: true, exitCode: 1 });
    expect(evaluateStagingShadowHealthSnapshot(blocked, true)).toEqual({ shouldFail: true, exitCode: 1 });
  });

  test('strict evaluation does not fail on idle collect_data snapshots', () => {
    const snapshot = createStagingShadowHealthSnapshot();

    expect(evaluateStagingShadowHealthSnapshot(snapshot, true)).toEqual({ shouldFail: false, exitCode: 0 });
  });

  test('output path writing is safe and deterministic', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-health-'));
    const outputPath = path.join(outputDir, 'snapshot.json');

    const stdout = execFileSync(process.execPath, [scriptPath, '--json', '--output', outputPath], {
      encoding: 'utf8',
    });

    const fileContent = fs.readFileSync(outputPath, 'utf8');
    expect(fileContent).toBe(stdout);
    expect(JSON.parse(fileContent).domainsIncluded).toEqual(['profile', 'savedLocations']);
  });

  test('help output works', () => {
    const stdout = execFileSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });

    expect(stdout).toContain('Usage: pnpm run report:staging-health');
    expect(stdout).toContain('--strict');
  });

  test('report records future domains without changing the core', () => {
    recordStagingShadowEvent({
      domain: 'notifications',
      operation: 'listNotifications',
      event: 'shadow_attempted',
    });

    const snapshot = createStagingShadowHealthSnapshot();
    expect(snapshot.domainsIncluded).toContain('notifications');
  });
});
