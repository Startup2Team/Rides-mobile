import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  evaluateStagingConnectionChecklist,
  formatStagingConnectionReport,
  getStagingConnectionBlockers,
  getStagingConnectionPendingEvidence,
  getStagingConnectionReport,
  isReadyForRealStagingShadow,
} from '..';
import { evaluateStagingDomainContract, getExpectedStagingDomainContracts } from '../stagingContractGate';

const evidencePath = path.resolve(__dirname, '../../../../../docs/staging/staging-connection-evidence.json');
const manifestPath = path.resolve(__dirname, '../../../../../docs/contracts/staging-backend-contract-manifest.json');

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function createEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    nodeEnv: 'development',
    backendEnv: undefined,
    backendBaseUrl: undefined,
    savedLocationsRepositoryMode: 'LOCAL',
    profileRepositoryMode: 'LOCAL',
    savedLocationsShadowWritesEnabled: undefined,
    profileShadowWritesEnabled: undefined,
    ...overrides,
  };
}

function createReadyEvidence(authStrategy: 'not_required' | 'injected_token_provider' = 'not_required') {
  const base = loadJson<any>(evidencePath);
  return {
    ...base,
    auth: {
      ...base.auth,
      requiresAuthentication: authStrategy === 'not_required' ? false : true,
      authStrategy,
      tokenProviderAvailable: authStrategy === 'not_required' ? false : true,
      tokenPersistenceOwnedByTransport: false,
    },
    isolation: {
      stagingDatabaseIsolation: 'confirmed',
      stagingObjectStorageIsolation: 'confirmed',
      stagingCredentialIsolation: 'confirmed',
      stagingLogsSeparated: 'confirmed',
      stagingSmsAndPaymentSideEffectsSandboxed: 'confirmed',
    },
    contracts: {
      endpointContractConfirmation: 'confirmed',
      backendOwnerConfirmationTimestamp: '2026-07-04T00:00:00.000Z',
      backendOwnerConfirmationReference: 'go-staging',
    },
    domainReadiness: {
      savedLocations: 'confirmed',
      profile: 'confirmed',
    },
    rateLimits: {
      backendRateLimitPolicyKnown: 'confirmed',
      retryAfterSupported: 'confirmed',
      stagingLimitsKnown: 'confirmed',
    },
  };
}

function createBlockedAuthEvidence() {
  return {
    ...createReadyEvidence('injected_token_provider'),
    auth: {
      requiresAuthentication: true,
      authStrategy: 'unresolved',
      tokenProviderAvailable: false,
      tokenPersistenceOwnedByTransport: false,
    },
  };
}

function createTransportPersistenceBlockedEvidence() {
  return {
    ...createReadyEvidence('injected_token_provider'),
    auth: {
      requiresAuthentication: true,
      authStrategy: 'injected_token_provider',
      tokenProviderAvailable: true,
      tokenPersistenceOwnedByTransport: true,
    },
  };
}

function createIsolationBlockedEvidence() {
  return {
    ...createReadyEvidence(),
    isolation: {
      stagingDatabaseIsolation: 'failed',
      stagingObjectStorageIsolation: 'failed',
      stagingCredentialIsolation: 'failed',
      stagingLogsSeparated: 'failed',
      stagingSmsAndPaymentSideEffectsSandboxed: 'failed',
    },
  };
}

describe('staging connection checklist', () => {
  beforeEach(() => {
    delete (globalThis as { __stagingConnectionTransportEvidence?: unknown }).__stagingConnectionTransportEvidence;
  });

  test('default state is not configured and does not claim readiness', async () => {
    const report = await evaluateStagingConnectionChecklist({ env: createEnv() });

    expect(report.overallStatus).toBe('not_configured');
    expect(report.recommendedAction).toBe('configure_staging');
    expect(report.checklistCategories.some(category => category.category === 'contracts')).toBe(true);
    expect(report.domainContractStatus.map(item => item.domain)).toEqual(['savedLocations', 'profile']);
    expect(report.criticalBlockers).toEqual([]);
    expect(await isReadyForRealStagingShadow({ env: createEnv() })).toBe(false);
  });

  test('invalid url and production conflict are blocked', async () => {
    const invalidUrl = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'not-a-url',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
      }),
    });
    const productionConflict = await evaluateStagingConnectionChecklist({
      env: createEnv({
        nodeEnv: 'production',
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
      }),
    });
    const remoteModeBlocked = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'REMOTE',
      }),
    });
    const hybridModeBlocked = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        profileRepositoryMode: 'HYBRID',
      }),
    });

    expect(invalidUrl.overallStatus).toBe('blocked');
    expect(productionConflict.overallStatus).toBe('blocked');
    expect(remoteModeBlocked.overallStatus).toBe('blocked');
    expect(hybridModeBlocked.overallStatus).toBe('blocked');
  });

  test('transport evidence passes and typed error mappings are available', async () => {
    const report = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
    });

    const transportCategory = report.checklistCategories.find(category => category.category === 'transport');
    expect(transportCategory?.items.every(item => item.status === 'passed')).toBe(true);
    expect(transportCategory?.items.some(item => item.key === 'transport:backend-client-bypass' && item.status === 'passed')).toBe(true);
    expect(report.checklistCategories.find(category => category.category === 'rollback')?.items.find(item => item.key === 'rollback:default-local')?.status).toBe('passed');
  });

  test('auth gate blocks unresolved required auth and passes accepted strategies', async () => {
    const blocked = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createBlockedAuthEvidence(),
      manifest: loadJson(manifestPath),
    });
    const notRequired = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createReadyEvidence('not_required'),
      manifest: loadJson(manifestPath),
    });
    const injectedProvider = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createReadyEvidence('injected_token_provider'),
      manifest: loadJson(manifestPath),
    });

    expect(blocked.overallStatus).toBe('blocked');
    expect(notRequired.overallStatus).toBe('ready_for_staging_shadow');
    expect(injectedProvider.overallStatus).toBe('ready_for_staging_shadow');
  });

  test('transport-owned token persistence blocks readiness', async () => {
    const report = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createTransportPersistenceBlockedEvidence(),
      manifest: loadJson(manifestPath),
    });

    expect(report.overallStatus).toBe('blocked');
    expect(report.criticalBlockers.some(blocker => blocker.includes('authentication:transport-token-persistence'))).toBe(true);
  });

  test('contract manifest validation works and missing operations block the domain', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-contract-'));
    const invalidManifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(invalidManifestPath, JSON.stringify({
      version: 1,
      domains: {
        savedLocations: {
          operations: [
            {
              operation: 'list',
              method: 'GET',
              path: '/v1/saved-locations',
              requestContract: 'none',
              responseContract: 'ListSavedLocationsResponseDto',
              authenticationExpected: 'required',
              idempotencyExpected: false,
              correlationExpected: true,
            },
          ],
        },
        profile: loadJson<any>(manifestPath).domains.profile,
      },
    }, null, 2));

    const contract = evaluateStagingDomainContract('savedLocations', loadJson(invalidManifestPath), createReadyEvidence());

    expect(contract.passed).toBe(false);
    expect(contract.missingOperations).toContain('create');
    expect(contract.missingOperations).toContain('update');
    expect(contract.missingOperations).toContain('delete');
  });

  test('isolation failures block readiness while privacy, observability, and resilience pass', async () => {
    const report = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createIsolationBlockedEvidence(),
      manifest: loadJson(manifestPath),
    });

    expect(report.overallStatus).toBe('blocked');
    expect(report.checklistCategories.find(category => category.category === 'privacy')?.items.every(item => item.status === 'passed')).toBe(true);
    expect(report.checklistCategories.find(category => category.category === 'observability')?.items.every(item => item.status === 'passed')).toBe(true);
    expect(report.checklistCategories.find(category => category.category === 'resilience')?.items.every(item => item.status === 'passed')).toBe(true);
    expect(report.checklistCategories.find(category => category.category === 'dataIsolation')?.items.some(item => item.status === 'failed')).toBe(true);
  });

  test('rate limits remain pending until backend policy is known', async () => {
    const report = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: loadJson(evidencePath),
      manifest: loadJson(manifestPath),
    });

    const rateLimits = report.checklistCategories.find(category => category.category === 'rateLimits');
    expect(rateLimits?.items.some(item => item.status === 'pending')).toBe(true);
  });

  test('all critical evidence passing yields ready_for_staging_shadow', async () => {
    const report = await evaluateStagingConnectionChecklist({
      env: createEnv({
        backendEnv: 'STAGING',
        backendBaseUrl: 'https://staging.example.test',
        savedLocationsRepositoryMode: 'SHADOW_REMOTE',
        profileRepositoryMode: 'SHADOW_REMOTE',
      }),
      evidence: createReadyEvidence('injected_token_provider'),
      manifest: loadJson(manifestPath),
    });

    expect(report.overallStatus).toBe('ready_for_staging_shadow');
    expect(report.recommendedAction).toBe('connect_staging_shadow');
    expect(report.domainContractStatus.every(item => item.passed)).toBe(true);
    expect(getStagingConnectionReport({
      env: createEnv(),
    })).toBeInstanceOf(Promise);
  });

  test('report formatting includes the contract section and pending evidence', async () => {
    const report = await getStagingConnectionReport({ env: createEnv() });
    const formatted = formatStagingConnectionReport(report);

    expect(formatted).toContain('Staging Backend Connection Checklist');
    expect(formatted).toContain('Domain contract status:');
    expect(await getStagingConnectionPendingEvidence({ env: createEnv() })).toEqual(report.pendingEvidence);
    expect(await getStagingConnectionBlockers({ env: createEnv() })).toEqual(report.criticalBlockers);
  });

  test('checked-in manifest does not contain URLs tokens secrets or phone numbers', () => {
    const content = fs.readFileSync(manifestPath, 'utf8');

    expect(content).not.toContain('https://');
    expect(content).not.toContain('http://');
    expect(content).not.toContain('token');
    expect(content).not.toContain('secret');
    expect(content).not.toContain('password');
    expect(content).not.toContain('+250');
  });
});
