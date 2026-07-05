import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const scriptPath = path.resolve(__dirname, '../../../../../scripts/check-staging-connection.js');

function runScript(args: string[], options: Record<string, unknown> = {}) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

describe('staging connection CLI', () => {
  test('help output works', () => {
    const output = runScript(['--help']);

    expect(output).toContain('Usage: pnpm run check:staging-connection');
    expect(output).toContain('--evidence');
    expect(output).toContain('--manifest');
  });

  test('default report is conservative and exits 0', () => {
    const output = runScript([]);

    expect(output).toContain('Overall status: not_configured');
    expect(output).toContain('Recommended action: configure_staging');
  });

  test('json output works', () => {
    const output = runScript(['--json']);
    const parsed = JSON.parse(output) as { overallStatus: string; domains: Array<{ domain: string }> };

    expect(parsed.overallStatus).toBe('not_configured');
    expect(parsed.domains.map(domain => domain.domain)).toEqual(expect.arrayContaining(['savedLocations', 'profile']));
  });

  test('strict mode fails blocked state', () => {
    expect(() => runScript(['--strict'], {
      env: {
        ...process.env,
        EXPO_PUBLIC_BACKEND_ENV: 'STAGING',
        EXPO_PUBLIC_BACKEND_BASE_URL: 'not-a-url',
        EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE: 'SHADOW_REMOTE',
        EXPO_PUBLIC_PROFILE_REPOSITORY_MODE: 'SHADOW_REMOTE',
      },
    })).toThrow();
  });

  test('strict mode fails invalid evidence and manifest files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-connection-cli-'));
    const invalidEvidencePath = path.join(tempDir, 'evidence.json');
    const invalidManifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(invalidEvidencePath, '{ invalid json');
    fs.writeFileSync(invalidManifestPath, '{ invalid json');

    expect(() => runScript(['--strict', '--evidence', invalidEvidencePath])).toThrow();
    expect(() => runScript(['--strict', '--manifest', invalidManifestPath])).toThrow();
  });
});
