import fs from 'fs';
import path from 'path';
import { BackendClient } from '../../client/backendClient';
import { BackendError, ConflictError, ForbiddenError, OfflineError, RateLimitedError, SerializationError, ServerError, TimeoutError, UnauthorizedError, ValidationError } from '../../contracts/backendErrors';
import { createHttpBackendTransport } from '../../transport/httpBackendTransport';
import { DEFAULT_BACKEND_REQUEST_TIMEOUT_MS, readBackendTransportEnvironment, resolveBackendTransportConfig, validateBackendBaseUrl } from '../../transport/backendTransportConfig';
import { DEFAULT_BACKEND_RETRY_POLICY, canRetryBackendRequest, getRetryDelayMs } from '../../transport/backendRetryPolicy';
import { getStagingShadowHealthReport, createStagingShadowHealthSnapshot } from '../health';
import type { BackendTransportEnvironment, HttpBackendTransportConfig } from '../../transport/httpBackendTransportTypes';
import type {
  StagingConnectionChecklistCategoryReport,
  StagingConnectionChecklistItem,
  StagingConnectionDomain,
  StagingConnectionDomainContractDefinition,
  StagingConnectionDomainContractOperation,
  StagingConnectionDomainContractStatus,
  StagingConnectionDomainReport,
  StagingConnectionEvidence,
  StagingConnectionItemStatus,
  StagingConnectionOverallStatus,
  StagingConnectionRecommendedAction,
  StagingConnectionReport,
} from './stagingConnectionTypes';
import {
  booleanStatusToItemStatus,
  confirmedStatusToItemStatus,
  isFailureStatus,
  isReadyOverallStatuses,
  isTerminalStatus,
  normalizeSeverity,
  stagingConnectionCategories,
  stagingConnectionCriticalCategories,
  stagingConnectionDomains,
} from './stagingConnectionPolicies';
import { evaluateStagingDomainContract, getExpectedStagingDomainContracts } from './stagingContractGate';
import type { StagingBackendContractManifest } from './stagingContractGate';

export interface StagingConnectionChecklistOptions {
  env?: BackendTransportEnvironment;
  evidencePath?: string;
  manifestPath?: string;
  evidence?: Partial<StagingConnectionEvidence>;
  manifest?: StagingBackendContractManifest;
  domains?: StagingConnectionDomain[];
  now?: Date;
}

export interface StagingConnectionCheckResult {
  report: StagingConnectionReport;
  evidence: StagingConnectionEvidence;
  manifest: StagingBackendContractManifest;
}

const repoRoot = path.resolve(__dirname, '../../../../../../');
const defaultEvidencePath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'staging', 'staging-connection-evidence.json');
const defaultManifestPath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'contracts', 'staging-backend-contract-manifest.json');

let transportEvidencePromise: Promise<Record<string, unknown>> | null = null;

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function readJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    return readJsonFile<T>(filePath);
  } catch {
    return null;
  }
}

function normalizeStatus(value: unknown): 'unknown' | 'confirmed' | 'failed' {
  if (value === 'confirmed') return 'confirmed';
  if (value === 'failed') return 'failed';
  return 'unknown';
}

function normalizeBooleanEvidence(value: unknown): 'unknown' | boolean {
  if (value === true || value === false) return value;
  return 'unknown';
}

function normalizeAuthStrategy(value: unknown) {
  if (value === 'not_required' || value === 'unresolved' || value === 'injected_token_provider' || value === 'service_test_identity' || value === 'unsupported') {
    return value;
  }
  return 'unresolved';
}

function normalizeEvidence(input: Partial<StagingConnectionEvidence> = {}): StagingConnectionEvidence {
  return {
    version: 1,
    auth: {
      requiresAuthentication: normalizeBooleanEvidence(input.auth?.requiresAuthentication),
      authStrategy: normalizeAuthStrategy(input.auth?.authStrategy),
      tokenProviderAvailable: normalizeBooleanEvidence(input.auth?.tokenProviderAvailable),
      tokenPersistenceOwnedByTransport: normalizeBooleanEvidence(input.auth?.tokenPersistenceOwnedByTransport),
    },
    isolation: {
      stagingDatabaseIsolation: normalizeStatus(input.isolation?.stagingDatabaseIsolation),
      stagingObjectStorageIsolation: normalizeStatus(input.isolation?.stagingObjectStorageIsolation),
      stagingCredentialIsolation: normalizeStatus(input.isolation?.stagingCredentialIsolation),
      stagingLogsSeparated: normalizeStatus(input.isolation?.stagingLogsSeparated),
      stagingSmsAndPaymentSideEffectsSandboxed: normalizeStatus(input.isolation?.stagingSmsAndPaymentSideEffectsSandboxed),
    },
    privacy: {
      telemetrySanitizationDocumented: normalizeStatus(input.privacy?.telemetrySanitizationDocumented),
      semanticComparisonSanitizationDocumented: normalizeStatus(input.privacy?.semanticComparisonSanitizationDocumented),
      rawBackendStackTracesBlocked: normalizeStatus(input.privacy?.rawBackendStackTracesBlocked),
      fullResponseBodiesLogged: normalizeStatus(input.privacy?.fullResponseBodiesLogged),
      requestPayloadsLogged: normalizeStatus(input.privacy?.requestPayloadsLogged),
    },
    observability: {
      correlationIdsSupported: normalizeStatus(input.observability?.correlationIdsSupported),
      requestIdsSupported: normalizeStatus(input.observability?.requestIdsSupported),
      stagingRequestTelemetryAvailable: normalizeStatus(input.observability?.stagingRequestTelemetryAvailable),
      successTelemetryAvailable: normalizeStatus(input.observability?.successTelemetryAvailable),
      failureTelemetryAvailable: normalizeStatus(input.observability?.failureTelemetryAvailable),
      timeoutTelemetryAvailable: normalizeStatus(input.observability?.timeoutTelemetryAvailable),
      latencyTelemetryAvailable: normalizeStatus(input.observability?.latencyTelemetryAvailable),
      mismatchTelemetryAvailable: normalizeStatus(input.observability?.mismatchTelemetryAvailable),
      stagingHealthAggregationWired: normalizeStatus(input.observability?.stagingHealthAggregationWired),
      snapshotReportAvailable: normalizeStatus(input.observability?.snapshotReportAvailable),
      ciArtifactAvailable: normalizeStatus(input.observability?.ciArtifactAvailable),
      baselineComparisonAvailable: normalizeStatus(input.observability?.baselineComparisonAvailable),
    },
    resilience: {
      timeoutConfigured: normalizeStatus(input.resilience?.timeoutConfigured),
      timeoutAbortSupport: normalizeStatus(input.resilience?.timeoutAbortSupport),
      boundedRetry: normalizeStatus(input.resilience?.boundedRetry),
      getRetrySafety: normalizeStatus(input.resilience?.getRetrySafety),
      unsafeWriteRetryBlocked: normalizeStatus(input.resilience?.unsafeWriteRetryBlocked),
      idempotentWriteMetadataSupported: normalizeStatus(input.resilience?.idempotentWriteMetadataSupported),
      exponentialBackoff: normalizeStatus(input.resilience?.exponentialBackoff),
      jitter: normalizeStatus(input.resilience?.jitter),
      localFallback: normalizeStatus(input.resilience?.localFallback),
      remoteTimeoutDoesNotBlockLocal: normalizeStatus(input.resilience?.remoteTimeoutDoesNotBlockLocal),
      remoteFailureDoesNotBlockLocal: normalizeStatus(input.resilience?.remoteFailureDoesNotBlockLocal),
      malformedResponseDoesNotBlockLocal: normalizeStatus(input.resilience?.malformedResponseDoesNotBlockLocal),
    },
    rateLimits: {
      backendRateLimitPolicyKnown: normalizeStatus(input.rateLimits?.backendRateLimitPolicyKnown),
      retryAfterSupported: normalizeStatus(input.rateLimits?.retryAfterSupported),
      stagingLimitsKnown: normalizeStatus(input.rateLimits?.stagingLimitsKnown),
    },
    rollback: {
      repositoryDefaultLocal: normalizeBooleanEvidence(input.rollback?.repositoryDefaultLocal),
      invalidConfigReturnsLocal: normalizeBooleanEvidence(input.rollback?.invalidConfigReturnsLocal),
      missingConfigReturnsLocal: normalizeBooleanEvidence(input.rollback?.missingConfigReturnsLocal),
      productionReturnsLocal: normalizeBooleanEvidence(input.rollback?.productionReturnsLocal),
      writeShadowIndependent: normalizeBooleanEvidence(input.rollback?.writeShadowIndependent),
      envFlagsRestoreLocal: normalizeBooleanEvidence(input.rollback?.envFlagsRestoreLocal),
      restartRequirementClaimed: normalizeBooleanEvidence(input.rollback?.restartRequirementClaimed),
    },
    contracts: {
      endpointContractConfirmation: normalizeStatus(input.contracts?.endpointContractConfirmation),
      backendOwnerConfirmationTimestamp: input.contracts?.backendOwnerConfirmationTimestamp ?? null,
      backendOwnerConfirmationReference: input.contracts?.backendOwnerConfirmationReference ?? null,
    },
    domainReadiness: {
      savedLocations: normalizeStatus(input.domainReadiness?.savedLocations),
      profile: normalizeStatus(input.domainReadiness?.profile),
    },
  };
}

function normalizeManifest(input: StagingBackendContractManifest | null | undefined) {
  if (!input || typeof input !== 'object') return null;
  return input;
}

function normalizedMode(value?: string) {
  return value?.trim().toUpperCase() ?? '';
}

function isLocalOrDisabledEnvironment(env: BackendTransportEnvironment) {
  return normalizedMode(env.backendEnv) === 'LOCAL' || normalizedMode(env.backendEnv) === 'DISABLED' || !env.backendEnv?.trim();
}

function hasExplicitStagingIntent(env: BackendTransportEnvironment) {
  const backendEnv = normalizedMode(env.backendEnv);
  const backendBaseUrl = env.backendBaseUrl?.trim();
  const modes = [normalizedMode(env.savedLocationsRepositoryMode), normalizedMode(env.profileRepositoryMode)];
  return backendEnv === 'STAGING'
    || backendEnv === 'PRODUCTION'
    || Boolean(backendBaseUrl)
    || modes.some(mode => mode === 'SHADOW_REMOTE' || mode === 'REMOTE' || mode === 'HYBRID');
}

function statusToCritical(blocking: boolean | 'unknown' | 'confirmed' | 'failed') {
  if (blocking === true || blocking === 'confirmed') return 'passed';
  if (blocking === false || blocking === 'failed') return 'blocked';
  return 'unknown';
}

function createItem(
  key: string,
  category: StagingConnectionChecklistItem['category'],
  status: StagingConnectionItemStatus,
  title: string,
  details: string,
  severity?: StagingConnectionChecklistItem['severity'],
  evidence?: Array<string | null | undefined>,
  blocker = false,
): StagingConnectionChecklistItem {
  return {
    key,
    category,
    status,
    severity: severity ?? normalizeSeverity(category, status),
    title,
    details,
    evidence: evidence?.filter((value): value is string => typeof value === 'string' && value.length > 0),
    blocker,
  };
}

function getTransportEvidenceSourcePaths() {
  return {
    httpBackendTransport: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'transport', 'httpBackendTransport.ts'),
    backendClient: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'client', 'backendClient.ts'),
    backendErrors: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'contracts', 'backendErrors.ts'),
    backendRetryPolicy: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'transport', 'backendRetryPolicy.ts'),
    backendTransportConfig: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'transport', 'backendTransportConfig.ts'),
    savedLocationsRemoteRepository: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'repositories', 'RemoteSavedLocationsRepository.ts'),
    profileRemoteRepository: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'repositories', 'RemoteProfileRepository.ts'),
    savedLocationsFactory: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'repositories', 'savedLocationsRepositoryFactory.ts'),
    profileFactory: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'repositories', 'profileRepositoryFactory.ts'),
    savedLocationsStagingFactory: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'staging', 'createSavedLocationsStagingShadow.ts'),
    profileStagingFactory: path.join(repoRoot, 'artifacts', 'mobile', 'data', 'remote', 'staging', 'createProfileStagingShadow.ts'),
  };
}

function readText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function sourceHasAll(filePath: string, patterns: RegExp[]) {
  const text = readText(filePath);
  return patterns.every(pattern => pattern.test(text));
}

async function evaluateTransportEvidence() {
  if (!transportEvidencePromise) {
    transportEvidencePromise = (async () => {
      const { httpBackendTransport, savedLocationsRemoteRepository, profileRemoteRepository, savedLocationsFactory, profileFactory, savedLocationsStagingFactory, profileStagingFactory } = getTransportEvidenceSourcePaths();
      const transportModule = require('../../transport/httpBackendTransport') as typeof import('../../transport/httpBackendTransport');
      const clientModule = require('../../client/backendClient') as typeof import('../../client/backendClient');
      const errorModule = require('../../contracts/backendErrors') as typeof import('../../contracts/backendErrors');
      const retryModule = require('../../transport/backendRetryPolicy') as typeof import('../../transport/backendRetryPolicy');

      const backendClientInstance = new clientModule.BackendClient({
        transport: async () => ({
          status: 200,
          data: { ok: true },
          headers: {},
        }),
      });

      const requestHeaderCheck = await (async () => {
        const captured: Record<string, string> = {};
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 25,
            fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
              Object.assign(captured, init?.headers ?? {});
              return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{"data":{"ok":true}}',
              };
            }) as unknown as typeof fetch,
            clientMetadata: {
              'X-Rides-Backend-Environment': 'staging',
              'X-Rides-Client-Platform': 'mobile',
            },
          },
          retryModule.DEFAULT_BACKEND_RETRY_POLICY,
        );
        await transport({
          method: 'POST',
          path: '/v1/headers',
          options: {
            body: { value: 1 },
            headers: {
              'X-Correlation-Id': 'corr-test',
              'X-Request-Id': 'req-test',
              'X-Idempotency-Key': 'idem-test',
            },
          },
        });
        return (
          captured.Accept === 'application/json'
          && captured['Content-Type'] === 'application/json'
          && captured['X-Correlation-Id'] === 'corr-test'
          && captured['X-Request-Id'] === 'req-test'
          && captured['X-Idempotency-Key'] === 'idem-test'
          && captured['X-Rides-Backend-Environment'] === 'staging'
        );
      })();

      const timeoutAbortSupport = await (async () => {
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 5,
            fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
              const signal = init?.signal;
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              signal?.addEventListener('abort', () => reject(abortError), { once: true });
            })) as unknown as typeof fetch,
          },
          { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 },
        );
        try {
          await transport({ method: 'GET', path: '/v1/timeout' });
          return false;
        } catch (error) {
          return error instanceof errorModule.TimeoutError;
        }
      })();

      const malformedJsonMapsToSerializationError = await (async () => {
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 25,
            fetchImpl: (async () => ({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              text: async () => '{invalid-json}',
            })) as unknown as typeof fetch,
          },
          { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 },
        );
        try {
          await transport({ method: 'GET', path: '/v1/bad-json' });
          return false;
        } catch (error) {
          return error instanceof errorModule.SerializationError;
        }
      })();

      const statusMappings = await (async () => {
        const cases: Array<[number, new (...args: any[]) => Error]> = [
          [400, errorModule.ValidationError],
          [401, errorModule.UnauthorizedError],
          [403, errorModule.ForbiddenError],
          [409, errorModule.ConflictError],
          [422, errorModule.ValidationError],
          [429, errorModule.RateLimitedError],
          [500, errorModule.ServerError],
        ];
        const results: Record<string, boolean> = {};
        for (const [status, ErrorType] of cases) {
          const transport = transportModule.createHttpBackendTransport(
            {
              baseUrl: 'https://staging.example.test',
              timeoutMs: 25,
              fetchImpl: (async () => ({
                ok: false,
                status,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{"error":"x"}',
              })) as unknown as typeof fetch,
            },
            { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 },
          );
          try {
            await transport({ method: 'GET', path: `/v1/status/${status}` });
            results[String(status)] = false;
          } catch (error) {
            results[String(status)] = error instanceof ErrorType;
          }
        }
        return results;
      })();

      const retryBounded = await (async () => {
        let calls = 0;
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 25,
            fetchImpl: (async () => {
              calls += 1;
              if (calls < 2) throw new Error('Network request failed');
              return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{"data":{"ok":true}}',
              };
            }) as unknown as typeof fetch,
          },
          { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 2 },
        );
        await transport({ method: 'GET', path: '/v1/retry' });
        return calls === 2;
      })();

      const unsafeWriteRetryBlocked = await (async () => {
        let calls = 0;
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 25,
            fetchImpl: (async () => {
              calls += 1;
              throw new Error('Network request failed');
            }) as unknown as typeof fetch,
          },
          { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 3 },
        );
        try {
          await transport({ method: 'POST', path: '/v1/write', options: { body: { value: 1 } } });
        } catch {
          // ignore
        }
        return calls === 1;
      })();

      const idempotentWriteMetadataSupported = await (async () => {
        let calls = 0;
        const transport = transportModule.createHttpBackendTransport(
          {
            baseUrl: 'https://staging.example.test',
            timeoutMs: 25,
            fetchImpl: (async () => {
              calls += 1;
              if (calls < 2) throw new Error('Network request failed');
              return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{"data":{"ok":true}}',
              };
            }) as unknown as typeof fetch,
          },
          { ...retryModule.DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 2 },
        );
        await transport({
          method: 'POST',
          path: '/v1/write',
          options: {
            body: { value: 1 },
            retrySafe: true,
            headers: { 'X-Idempotency-Key': 'idem-test' },
          },
        });
        return calls === 2;
      })();

      const getRetrySafety = canRetryBackendRequest({
        method: 'GET',
        error: new errorModule.TimeoutError({ repository: 'backend-client', method: 'get', transport: 'http' }),
      });

      const unsafeRetrySafety = canRetryBackendRequest({
        method: 'POST',
        error: new errorModule.TimeoutError({ repository: 'backend-client', method: 'post', transport: 'http' }),
      });

      const backendClientUsed = typeof backendClientInstance.get === 'function'
        && typeof backendClientInstance.post === 'function'
        && typeof backendClientInstance.put === 'function'
        && typeof backendClientInstance.patch === 'function'
        && typeof backendClientInstance.delete === 'function'
        && typeof backendClientInstance.upload === 'function'
        && typeof backendClientInstance.download === 'function';

      const httpBackendTransportUsed = typeof transportModule.createHttpBackendTransport === 'function';

      const typedBackendErrorsExist = [
        errorModule.BackendError,
        errorModule.BackendUnavailableError,
        errorModule.UnauthorizedError,
        errorModule.ForbiddenError,
        errorModule.ConflictError,
        errorModule.ValidationError,
        errorModule.RateLimitedError,
        errorModule.ServerError,
        errorModule.TimeoutError,
        errorModule.OfflineError,
        errorModule.SerializationError,
      ].every(value => typeof value === 'function');

      const retryPolicyBounded = DEFAULT_BACKEND_RETRY_POLICY.maxAttempts >= 2
        && DEFAULT_BACKEND_RETRY_POLICY.baseDelayMs > 0
        && DEFAULT_BACKEND_RETRY_POLICY.maxDelayMs >= DEFAULT_BACKEND_RETRY_POLICY.baseDelayMs
        && DEFAULT_BACKEND_RETRY_POLICY.jitterRatio >= 0;

      const repositoriesUseBackendClient = sourceHasAll(savedLocationsRemoteRepository, [
        /class\s+RemoteSavedLocationsRepository/,
        /this\.client\.(get|post|patch|delete)/,
      ]) && sourceHasAll(profileRemoteRepository, [
        /class\s+RemoteProfileRepository/,
        /this\.client\.(get|post|patch)/,
      ]) && sourceHasAll(savedLocationsStagingFactory, [
        /createHttpBackendTransport/,
        /new\s+BackendClient\(/,
      ]) && sourceHasAll(profileStagingFactory, [
        /createHttpBackendTransport/,
        /new\s+BackendClient\(/,
      ]);

      return {
        backendClientUsed,
        httpBackendTransportUsed,
        timeoutConfigured: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS > 0,
        timeoutAbortSupport,
        typedBackendErrorsExist,
        retryPolicyBounded,
        getRetrySafety,
        unsafeWriteRetryBlocked: unsafeRetrySafety === false,
        idempotentWriteMetadataSupported,
        malformedJsonMapsToSerializationError,
        requestHeaderMetadataSupported: requestHeaderCheck,
        status401: statusMappings['401'],
        status403: statusMappings['403'],
        status409: statusMappings['409'],
        status422: statusMappings['422'],
        status429: statusMappings['429'],
        status500: statusMappings['500'],
        repositoriesUseBackendClient,
        transportSourceEvidence: sourceHasAll(httpBackendTransport, [
          /AbortController/,
          /TimeoutError/,
          /SerializationError/,
          /RateLimitedError/,
          /X-Correlation-Id/,
          /X-Request-Id/,
          /X-Idempotency-Key/,
          /Accept/,
          /Content-Type/,
        ]),
        fetchRetriesSupported: canRetryBackendRequest({
          method: 'GET',
          error: new errorModule.RateLimitedError({ repository: 'backend-client', method: 'get', transport: 'http' }),
        }),
      };
    })();
  }

  return transportEvidencePromise;
}

function defaultManifest(): StagingBackendContractManifest | null {
  const manifestPath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'contracts', 'staging-backend-contract-manifest.json');
  return readJsonFileSafe<StagingBackendContractManifest>(manifestPath);
}

function defaultEvidence(): Partial<StagingConnectionEvidence> | null {
  const evidencePath = path.join(repoRoot, 'artifacts', 'mobile', 'docs', 'staging', 'staging-connection-evidence.json');
  return readJsonFileSafe<Partial<StagingConnectionEvidence>>(evidencePath);
}

function evaluateEnvironmentChecklist(env: BackendTransportEnvironment, evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  const backendEnv = normalizedMode(env.backendEnv);
  const backendBaseUrl = env.backendBaseUrl?.trim() ?? '';
  const backendEnabled = resolveBackendTransportConfig(env);
  const stagingIntent = hasExplicitStagingIntent(env);
  const modeValues = [normalizedMode(env.savedLocationsRepositoryMode), normalizedMode(env.profileRepositoryMode)];
  const hasInvalidMode = modeValues.some(mode => mode === 'REMOTE' || mode === 'HYBRID');
  const hasShadowRemoteMode = modeValues.some(mode => mode === 'SHADOW_REMOTE');
  const productionConflict = normalizedMode(env.nodeEnv) === 'PRODUCTION' && (backendEnv === 'STAGING' || hasShadowRemoteMode);

  if (!stagingIntent) {
    items.push(createItem(
      'environment:not-configured',
      'environment',
      'not_applicable',
      'staging not configured',
      'No staging environment or backend URL is set, so the app stays on LOCAL.',
    ));
    return {
      items,
      overallEnvironmentStatus: 'not_configured' as const,
      blocked: false,
      pending: false,
      ready: false,
      productionConflict: false,
      hasShadowRemoteMode,
    };
  }

  items.push(createItem(
    'environment:backend-env',
    'environment',
    backendEnv === 'STAGING' ? 'passed' : backendEnv === 'PRODUCTION' ? 'blocked' : backendEnv ? 'pending' : 'unknown',
    'backend environment',
    backendEnv === 'STAGING'
      ? 'Backend environment is explicitly STAGING.'
      : backendEnv === 'PRODUCTION'
        ? 'Production backend environment cannot consume staging configuration.'
        : 'Backend environment is not yet confirmed as STAGING.',
    undefined,
    ['EXPO_PUBLIC_BACKEND_ENV'],
    backendEnv === 'PRODUCTION',
  ));

  const validatedBaseUrl = backendBaseUrl ? validateBackendBaseUrl(backendBaseUrl, backendEnv === 'PRODUCTION' ? 'PRODUCTION' : 'STAGING') : { ok: false, reason: 'missing-base-url' };
  items.push(createItem(
    'environment:backend-base-url',
    'environment',
    backendBaseUrl ? (validatedBaseUrl.ok ? 'passed' : 'failed') : 'pending',
    'backend base URL',
    backendBaseUrl ? 'Backend base URL is present.' : 'Backend base URL is not yet configured.',
    undefined,
    backendBaseUrl ? [backendBaseUrl] : [],
    Boolean(backendBaseUrl && !validatedBaseUrl.ok),
  ));

  items.push(createItem(
    'environment:https-remote',
    'environment',
    backendBaseUrl ? (validatedBaseUrl.ok ? 'passed' : 'failed') : 'pending',
    'HTTPS for remote URLs',
    backendBaseUrl ? 'Remote backend URL is HTTPS-safe.' : 'Remote backend URL is not yet configured.',
    undefined,
    backendBaseUrl ? [backendBaseUrl] : [],
    Boolean(backendBaseUrl && !validatedBaseUrl.ok),
  ));

  items.push(createItem(
    'environment:repository-mode',
    'environment',
    hasInvalidMode ? 'blocked' : hasShadowRemoteMode ? 'passed' : 'pending',
    'repository mode',
    hasInvalidMode
      ? 'REMOTE and HYBRID repository modes are not allowed in this phase.'
      : hasShadowRemoteMode
        ? 'Repository mode is explicitly SHADOW_REMOTE.'
        : 'Repository mode is still LOCAL and has not opted into staging shadow.',
    undefined,
    modeValues,
    hasInvalidMode,
  ));

  items.push(createItem(
    'environment:production-conflict',
    'environment',
    productionConflict ? 'blocked' : 'passed',
    'production conflict',
    productionConflict
      ? 'Production runtime cannot consume staging configuration.'
      : 'No production/staging conflict detected.',
    'critical',
    [env.nodeEnv ?? 'unknown'],
    productionConflict,
  ));

  const blocked = items.some(item => item.status === 'blocked' || item.status === 'failed');
  const pending = items.some(item => item.status === 'pending' || item.status === 'unknown');
  const ready = items.every(item => item.status === 'passed' || item.status === 'not_applicable');

  return {
    items,
    overallEnvironmentStatus: blocked
      ? 'blocked'
      : ready && backendEnabled.enabled && backendEnabled.environment === 'STAGING'
        ? 'ready_for_staging_shadow'
        : pending
          ? 'pending_evidence'
          : 'not_configured',
    blocked,
    pending,
    ready,
    productionConflict,
    hasShadowRemoteMode,
  };
}

function evaluateTransportChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  const transportEvidence = (awaitableTransportEvidence() ?? {}) as Record<string, unknown>;
  const transportSourceEvidence = transportEvidence?.transportSourceEvidence !== false;
  const status401 = transportEvidence?.status401 !== false;
  const status403 = transportEvidence?.status403 !== false;
  const status409 = transportEvidence?.status409 !== false;
  const status422 = transportEvidence?.status422 !== false;
  const status429 = transportEvidence?.status429 !== false;
  const status500 = transportEvidence?.status500 !== false;
  void evidence;

  items.push(createItem('transport:backend-client', 'transport', transportEvidence?.backendClientUsed === false ? 'failed' : 'passed', 'BackendClient is available', 'Repositories continue to use BackendClient as the transport boundary.', 'critical', ['BackendClient']));
  items.push(createItem('transport:http-backend-transport', 'transport', transportEvidence?.httpBackendTransportUsed === false ? 'failed' : 'passed', 'HttpBackendTransport is available', 'The real HTTP transport exists underneath BackendClient.', 'critical', ['HttpBackendTransport']));
  items.push(createItem('transport:timeout-configured', 'transport', transportEvidence?.timeoutConfigured === false ? 'failed' : 'passed', 'timeout policy exists', `Default backend request timeout is ${DEFAULT_BACKEND_REQUEST_TIMEOUT_MS}ms.`, 'critical'));
  items.push(createItem('transport:timeout-abort', 'transport', transportEvidence?.timeoutAbortSupport === false ? 'failed' : 'passed', 'timeout abort support', 'Transport aborts timed-out requests.', 'critical'));
  items.push(createItem('transport:typed-errors', 'transport', transportEvidence?.typedBackendErrorsExist === false ? 'failed' : 'passed', 'typed backend errors', 'Timeout, offline, validation, rate-limit, conflict, unauthorized, forbidden, server, and serialization errors exist.', 'critical'));
  items.push(createItem('transport:bounded-retry', 'transport', transportEvidence?.retryPolicyBounded === false ? 'failed' : 'passed', 'bounded retry policy', `Retry policy is bounded at ${DEFAULT_BACKEND_RETRY_POLICY.maxAttempts} attempts.`, 'critical'));
  items.push(createItem('transport:get-retry', 'transport', transportEvidence?.getRetrySafety === false ? 'failed' : 'passed', 'GET retry safety', 'GET requests may retry transient failures.', 'critical'));
  items.push(createItem('transport:unsafe-write-retry', 'transport', transportEvidence?.unsafeWriteRetryBlocked === false ? 'failed' : 'passed', 'unsafe write retry blocked', 'Unsafe writes do not automatically retry without idempotency metadata.', 'critical'));
  items.push(createItem('transport:idempotent-write-metadata', 'transport', transportEvidence?.idempotentWriteMetadataSupported === false ? 'failed' : 'passed', 'idempotent write metadata', 'Retry-safe writes support idempotency metadata.', 'critical'));
  items.push(createItem('transport:malformed-json', 'transport', transportEvidence?.malformedJsonMapsToSerializationError === false ? 'failed' : 'passed', 'malformed JSON mapping', 'Malformed JSON maps to SerializationError.', 'critical'));
  items.push(createItem('transport:status-401', 'transport', status401 ? 'passed' : 'failed', '401 mapping', '401 maps to UnauthorizedError.', 'critical'));
  items.push(createItem('transport:status-403', 'transport', status403 ? 'passed' : 'failed', '403 mapping', '403 maps to ForbiddenError.', 'critical'));
  items.push(createItem('transport:status-409', 'transport', status409 ? 'passed' : 'failed', '409 mapping', '409 maps to ConflictError.', 'critical'));
  items.push(createItem('transport:status-422', 'transport', status422 ? 'passed' : 'failed', '422 mapping', '422 maps to ValidationError.', 'critical'));
  items.push(createItem('transport:status-429', 'transport', status429 ? 'passed' : 'failed', '429 mapping', '429 maps to RateLimitedError and retry is bounded.', 'critical'));
  items.push(createItem('transport:status-500', 'transport', status500 ? 'passed' : 'failed', '5xx mapping', '5xx maps to ServerError.', 'critical'));
  items.push(createItem('transport:backend-client-bypass', 'transport', transportSourceEvidence ? 'passed' : 'failed', 'repositories use BackendClient', 'Saved Locations and Profile remote paths stay behind BackendClient.', 'critical'));

  return items;
}

function awaitableTransportEvidence() {
  return (globalThis as Record<string, unknown>).__stagingConnectionTransportEvidence as Record<string, unknown> | undefined;
}

async function getTransportEvidence() {
  if (!(globalThis as Record<string, unknown>).__stagingConnectionTransportEvidence) {
    const evidence = await evaluateTransportEvidence();
    (globalThis as Record<string, unknown>).__stagingConnectionTransportEvidence = evidence;
  }
  return awaitableTransportEvidence() ?? {};
}

function evaluateAuthChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  const required = evidence.auth.requiresAuthentication;
  const authStrategy = evidence.auth.authStrategy;
  const tokenProviderAvailable = evidence.auth.tokenProviderAvailable;
  const tokenPersistenceOwnedByTransport = evidence.auth.tokenPersistenceOwnedByTransport;

  const strategyStatus = authStrategy === 'not_required'
    ? 'passed'
    : authStrategy === 'injected_token_provider' || authStrategy === 'service_test_identity'
      ? 'passed'
      : authStrategy === 'unsupported'
        ? 'blocked'
        : required === true && authStrategy === 'unresolved'
          ? 'blocked'
        : 'pending';

  items.push(createItem(
    'authentication:requires-auth',
    'authentication',
    required === true ? 'passed' : required === false ? 'passed' : 'pending',
    'authentication requirement',
    required === true
      ? 'The backend requires authentication.'
      : required === false
        ? 'Authentication is not required for this connection.'
        : 'Authentication requirement is not yet confirmed.',
    'critical',
    [String(required)],
  ));

  items.push(createItem(
    'authentication:strategy',
    'authentication',
    strategyStatus,
    'auth strategy',
    authStrategy === 'injected_token_provider'
      ? 'Token provider is injected.'
      : authStrategy === 'service_test_identity'
        ? 'Service test identity is available.'
        : authStrategy === 'not_required'
          ? 'Authentication is not required.'
          : authStrategy === 'unsupported'
            ? 'The current auth strategy is unsupported.'
            : 'Auth strategy is unresolved.',
    'critical',
    [authStrategy],
    authStrategy === 'unsupported' || (required === true && authStrategy === 'unresolved'),
  ));

  items.push(createItem(
    'authentication:token-provider',
    'authentication',
    tokenProviderAvailable === true || tokenProviderAvailable === false ? 'passed' : 'pending',
    'token provider availability',
    tokenProviderAvailable === true ? 'An injected token provider is available.' : tokenProviderAvailable === false ? 'No token provider is available yet.' : 'Token provider availability is not yet known.',
    'critical',
    [String(tokenProviderAvailable)],
  ));

  items.push(createItem(
    'authentication:transport-token-persistence',
    'authentication',
    tokenPersistenceOwnedByTransport === true ? 'blocked' : tokenPersistenceOwnedByTransport === false ? 'passed' : 'pending',
    'transport-owned token persistence',
    tokenPersistenceOwnedByTransport === true
      ? 'HttpBackendTransport must not own token persistence.'
      : tokenPersistenceOwnedByTransport === false
        ? 'Transport does not own token persistence.'
        : 'Transport token persistence ownership is unresolved.',
    'critical',
    [String(tokenPersistenceOwnedByTransport)],
    tokenPersistenceOwnedByTransport === true,
  ));

  return items;
}

function evaluateDomainReadinessChecklist(
  domain: StagingConnectionDomain,
  contractStatus: ReturnType<typeof evaluateStagingDomainContract>,
  evidence: StagingConnectionEvidence,
  env: BackendTransportEnvironment,
) {
  const items: StagingConnectionChecklistItem[] = [];
  const readySource = evidence.domainReadiness[domain as keyof StagingConnectionEvidence['domainReadiness']] ?? 'unknown';
  const backendEnv = normalizedMode(env.backendEnv);
  const mode = normalizedMode(domain === 'savedLocations' ? env.savedLocationsRepositoryMode : env.profileRepositoryMode);
  const readinessStatus: StagingConnectionItemStatus = contractStatus.passed
    ? readySource === 'confirmed'
      ? 'passed'
      : readySource === 'failed'
        ? 'failed'
        : 'pending'
    : 'blocked';

  items.push(createItem(
    `domain:${domain}`,
    'domainReadiness',
    readinessStatus,
    `${domain} staging readiness`,
    contractStatus.passed
      ? readySource === 'confirmed'
        ? `${domain} contract and readiness evidence are confirmed.`
        : `${domain} readiness is still awaiting evidence.`
      : `${domain} contract checks are not complete.`,
    'critical',
    [backendEnv, mode, readySource],
    readinessStatus === 'blocked' || readinessStatus === 'failed',
  ));

  return items;
}

function evaluateIsolationChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  const db = evidence.isolation.stagingDatabaseIsolation;
  const objectStorage = evidence.isolation.stagingObjectStorageIsolation;
  const credentials = evidence.isolation.stagingCredentialIsolation;
  const logs = evidence.isolation.stagingLogsSeparated;
  const sideEffects = evidence.isolation.stagingSmsAndPaymentSideEffectsSandboxed;

  items.push(createItem('isolation:database', 'dataIsolation', confirmedStatusToItemStatus(db), 'staging database isolation', db === 'confirmed' ? 'Staging database isolation is confirmed.' : db === 'failed' ? 'Staging database isolation failed.' : 'Staging database isolation is unknown.', 'critical', [db]));
  items.push(createItem('isolation:object-storage', 'dataIsolation', confirmedStatusToItemStatus(objectStorage), 'staging object storage isolation', objectStorage === 'confirmed' ? 'Staging object storage isolation is confirmed.' : objectStorage === 'failed' ? 'Staging object storage isolation failed.' : 'Staging object storage isolation is unknown.', 'critical', [objectStorage]));
  items.push(createItem('isolation:credentials', 'dataIsolation', confirmedStatusToItemStatus(credentials), 'staging credential isolation', credentials === 'confirmed' ? 'Staging credentials are isolated from production.' : credentials === 'failed' ? 'Staging credentials reuse production credentials.' : 'Staging credential isolation is unknown.', 'critical', [credentials]));
  items.push(createItem('isolation:logs', 'dataIsolation', confirmedStatusToItemStatus(logs), 'staging logs separation', logs === 'confirmed' ? 'Staging logs are separated from production.' : logs === 'failed' ? 'Staging logs are not separated.' : 'Staging logs separation is unknown.', 'warning', [logs]));
  items.push(createItem('isolation:side-effects', 'dataIsolation', confirmedStatusToItemStatus(sideEffects), 'staging side-effect sandboxing', sideEffects === 'confirmed' ? 'SMS/payment side effects are sandboxed or disabled.' : sideEffects === 'failed' ? 'SMS/payment side effects are not safely isolated.' : 'SMS/payment side-effect isolation is unknown.', 'warning', [sideEffects]));
  return items;
}

function evaluatePrivacyChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  items.push(createItem('privacy:telemetry-sanitized', 'privacy', confirmedStatusToItemStatus(evidence.privacy.telemetrySanitizationDocumented), 'telemetry sanitization', evidence.privacy.telemetrySanitizationDocumented === 'confirmed' ? 'Telemetry sanitization is documented.' : evidence.privacy.telemetrySanitizationDocumented === 'failed' ? 'Telemetry sanitization is missing.' : 'Telemetry sanitization is not yet confirmed.', 'critical', [evidence.privacy.telemetrySanitizationDocumented]));
  items.push(createItem('privacy:semantic-sanitized', 'privacy', confirmedStatusToItemStatus(evidence.privacy.semanticComparisonSanitizationDocumented), 'semantic comparison sanitization', evidence.privacy.semanticComparisonSanitizationDocumented === 'confirmed' ? 'Semantic comparison is sanitized.' : evidence.privacy.semanticComparisonSanitizationDocumented === 'failed' ? 'Semantic comparison sanitization is missing.' : 'Semantic comparison sanitization is not yet confirmed.', 'critical', [evidence.privacy.semanticComparisonSanitizationDocumented]));
  items.push(createItem('privacy:raw-stack-traces', 'privacy', confirmedStatusToItemStatus(evidence.privacy.rawBackendStackTracesBlocked), 'raw backend stack traces', evidence.privacy.rawBackendStackTracesBlocked === 'confirmed' ? 'Raw backend stack traces are blocked from logs.' : evidence.privacy.rawBackendStackTracesBlocked === 'failed' ? 'Raw backend stack traces may be logged.' : 'Raw backend stack trace handling is not yet confirmed.', 'critical', [evidence.privacy.rawBackendStackTracesBlocked]));
  items.push(createItem('privacy:full-response-bodies', 'privacy', confirmedStatusToItemStatus(evidence.privacy.fullResponseBodiesLogged), 'full response bodies logged', evidence.privacy.fullResponseBodiesLogged === 'confirmed' ? 'Full response bodies are not logged.' : evidence.privacy.fullResponseBodiesLogged === 'failed' ? 'Full response bodies may be logged.' : 'Response-body logging behavior is not yet confirmed.', 'critical', [evidence.privacy.fullResponseBodiesLogged]));
  items.push(createItem('privacy:request-payloads', 'privacy', confirmedStatusToItemStatus(evidence.privacy.requestPayloadsLogged), 'request payload logging', evidence.privacy.requestPayloadsLogged === 'confirmed' ? 'Request payloads are not blindly logged.' : evidence.privacy.requestPayloadsLogged === 'failed' ? 'Request payloads may be logged.' : 'Request payload logging behavior is not yet confirmed.', 'critical', [evidence.privacy.requestPayloadsLogged]));
  return items;
}

function evaluateObservabilityChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  items.push(createItem('observability:correlation-ids', 'observability', confirmedStatusToItemStatus(evidence.observability.correlationIdsSupported), 'correlation IDs', evidence.observability.correlationIdsSupported === 'confirmed' ? 'Correlation IDs are supported.' : 'Correlation ID support is not yet confirmed.', 'critical', [evidence.observability.correlationIdsSupported]));
  items.push(createItem('observability:request-ids', 'observability', confirmedStatusToItemStatus(evidence.observability.requestIdsSupported), 'request IDs', evidence.observability.requestIdsSupported === 'confirmed' ? 'Request IDs are supported.' : 'Request ID support is not yet confirmed.', 'critical', [evidence.observability.requestIdsSupported]));
  items.push(createItem('observability:staging-request-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.stagingRequestTelemetryAvailable), 'staging request telemetry', evidence.observability.stagingRequestTelemetryAvailable === 'confirmed' ? 'Staging request telemetry is available.' : 'Staging request telemetry is not yet confirmed.', 'critical', [evidence.observability.stagingRequestTelemetryAvailable]));
  items.push(createItem('observability:success-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.successTelemetryAvailable), 'success telemetry', evidence.observability.successTelemetryAvailable === 'confirmed' ? 'Success telemetry is available.' : 'Success telemetry is not yet confirmed.', 'critical', [evidence.observability.successTelemetryAvailable]));
  items.push(createItem('observability:failure-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.failureTelemetryAvailable), 'failure telemetry', evidence.observability.failureTelemetryAvailable === 'confirmed' ? 'Failure telemetry is available.' : 'Failure telemetry is not yet confirmed.', 'critical', [evidence.observability.failureTelemetryAvailable]));
  items.push(createItem('observability:timeout-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.timeoutTelemetryAvailable), 'timeout telemetry', evidence.observability.timeoutTelemetryAvailable === 'confirmed' ? 'Timeout telemetry is available.' : 'Timeout telemetry is not yet confirmed.', 'critical', [evidence.observability.timeoutTelemetryAvailable]));
  items.push(createItem('observability:latency-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.latencyTelemetryAvailable), 'latency telemetry', evidence.observability.latencyTelemetryAvailable === 'confirmed' ? 'Latency telemetry is available.' : 'Latency telemetry is not yet confirmed.', 'critical', [evidence.observability.latencyTelemetryAvailable]));
  items.push(createItem('observability:mismatch-telemetry', 'observability', confirmedStatusToItemStatus(evidence.observability.mismatchTelemetryAvailable), 'mismatch telemetry', evidence.observability.mismatchTelemetryAvailable === 'confirmed' ? 'Mismatch telemetry is available.' : 'Mismatch telemetry is not yet confirmed.', 'critical', [evidence.observability.mismatchTelemetryAvailable]));
  items.push(createItem('observability:health-aggregation', 'observability', confirmedStatusToItemStatus(evidence.observability.stagingHealthAggregationWired), 'health aggregation', evidence.observability.stagingHealthAggregationWired === 'confirmed' ? 'Staging shadow health aggregation is wired.' : 'Staging shadow health aggregation is not yet confirmed.', 'critical', [evidence.observability.stagingHealthAggregationWired]));
  items.push(createItem('observability:snapshot-report', 'observability', confirmedStatusToItemStatus(evidence.observability.snapshotReportAvailable), 'snapshot report', evidence.observability.snapshotReportAvailable === 'confirmed' ? 'Snapshot report generation is available.' : 'Snapshot report generation is not yet confirmed.', 'critical', [evidence.observability.snapshotReportAvailable]));
  items.push(createItem('observability:ci-artifact', 'observability', confirmedStatusToItemStatus(evidence.observability.ciArtifactAvailable), 'CI artifact', evidence.observability.ciArtifactAvailable === 'confirmed' ? 'CI artifact archiving is available.' : 'CI artifact archiving is not yet confirmed.', 'critical', [evidence.observability.ciArtifactAvailable]));
  items.push(createItem('observability:baseline-comparison', 'observability', confirmedStatusToItemStatus(evidence.observability.baselineComparisonAvailable), 'baseline comparison', evidence.observability.baselineComparisonAvailable === 'confirmed' ? 'Baseline comparison is available.' : 'Baseline comparison is not yet confirmed.', 'critical', [evidence.observability.baselineComparisonAvailable]));
  return items;
}

function evaluateResilienceChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  items.push(createItem('resilience:timeout-configured', 'resilience', confirmedStatusToItemStatus(evidence.resilience.timeoutConfigured), 'timeout configured', evidence.resilience.timeoutConfigured === 'confirmed' ? 'Timeout is configured.' : 'Timeout is not yet confirmed.', 'critical', [evidence.resilience.timeoutConfigured]));
  items.push(createItem('resilience:abort-support', 'resilience', confirmedStatusToItemStatus(evidence.resilience.timeoutAbortSupport), 'timeout abort support', evidence.resilience.timeoutAbortSupport === 'confirmed' ? 'Timeouts abort requests.' : 'Timeout abort support is not yet confirmed.', 'critical', [evidence.resilience.timeoutAbortSupport]));
  items.push(createItem('resilience:bounded-retry', 'resilience', confirmedStatusToItemStatus(evidence.resilience.boundedRetry), 'bounded retry', evidence.resilience.boundedRetry === 'confirmed' ? 'Retry is bounded.' : 'Bounded retry is not yet confirmed.', 'critical', [evidence.resilience.boundedRetry]));
  items.push(createItem('resilience:get-retry-safety', 'resilience', confirmedStatusToItemStatus(evidence.resilience.getRetrySafety), 'GET retry safety', evidence.resilience.getRetrySafety === 'confirmed' ? 'GET retry safety is present.' : 'GET retry safety is not yet confirmed.', 'critical', [evidence.resilience.getRetrySafety]));
  items.push(createItem('resilience:unsafe-write-retry', 'resilience', confirmedStatusToItemStatus(evidence.resilience.unsafeWriteRetryBlocked), 'unsafe write retry', evidence.resilience.unsafeWriteRetryBlocked === 'confirmed' ? 'Unsafe write retries are blocked.' : 'Unsafe write retry restrictions are not yet confirmed.', 'critical', [evidence.resilience.unsafeWriteRetryBlocked]));
  items.push(createItem('resilience:idempotent-write-metadata', 'resilience', confirmedStatusToItemStatus(evidence.resilience.idempotentWriteMetadataSupported), 'idempotent write metadata', evidence.resilience.idempotentWriteMetadataSupported === 'confirmed' ? 'Idempotent write metadata is supported.' : 'Idempotent write metadata support is not yet confirmed.', 'critical', [evidence.resilience.idempotentWriteMetadataSupported]));
  items.push(createItem('resilience:exponential-backoff', 'resilience', confirmedStatusToItemStatus(evidence.resilience.exponentialBackoff), 'exponential backoff', evidence.resilience.exponentialBackoff === 'confirmed' ? 'Exponential backoff is configured.' : 'Exponential backoff is not yet confirmed.', 'critical', [evidence.resilience.exponentialBackoff]));
  items.push(createItem('resilience:jitter', 'resilience', confirmedStatusToItemStatus(evidence.resilience.jitter), 'retry jitter', evidence.resilience.jitter === 'confirmed' ? 'Jitter is configured.' : 'Retry jitter is not yet confirmed.', 'critical', [evidence.resilience.jitter]));
  items.push(createItem('resilience:local-fallback', 'resilience', confirmedStatusToItemStatus(evidence.resilience.localFallback), 'local fallback', evidence.resilience.localFallback === 'confirmed' ? 'Local fallback remains authoritative.' : 'Local fallback is not yet confirmed.', 'critical', [evidence.resilience.localFallback]));
  items.push(createItem('resilience:remote-timeout-does-not-block-local', 'resilience', confirmedStatusToItemStatus(evidence.resilience.remoteTimeoutDoesNotBlockLocal), 'remote timeout fallback', evidence.resilience.remoteTimeoutDoesNotBlockLocal === 'confirmed' ? 'Remote timeout does not block local results.' : 'Remote timeout fallback is not yet confirmed.', 'critical', [evidence.resilience.remoteTimeoutDoesNotBlockLocal]));
  items.push(createItem('resilience:remote-failure-does-not-block-local', 'resilience', confirmedStatusToItemStatus(evidence.resilience.remoteFailureDoesNotBlockLocal), 'remote failure fallback', evidence.resilience.remoteFailureDoesNotBlockLocal === 'confirmed' ? 'Remote failure does not block local results.' : 'Remote failure fallback is not yet confirmed.', 'critical', [evidence.resilience.remoteFailureDoesNotBlockLocal]));
  items.push(createItem('resilience:malformed-response-does-not-block-local', 'resilience', confirmedStatusToItemStatus(evidence.resilience.malformedResponseDoesNotBlockLocal), 'malformed response fallback', evidence.resilience.malformedResponseDoesNotBlockLocal === 'confirmed' ? 'Malformed responses do not block local results.' : 'Malformed response fallback is not yet confirmed.', 'critical', [evidence.resilience.malformedResponseDoesNotBlockLocal]));
  return items;
}

function evaluateContractsChecklist(
  domainContracts: StagingConnectionDomainReport['contract'][],
  evidence: StagingConnectionEvidence,
) {
  const items: StagingConnectionChecklistItem[] = [];

  for (const contract of domainContracts) {
    items.push(createItem(
      `contracts:${contract.domain}`,
      'contracts',
      contract.passed ? 'passed' : 'blocked',
      `${contract.domain} contract manifest`,
      contract.passed
        ? `${contract.domain} mobile contract expectation matches the checked-in manifest.`
        : `${contract.domain} contract expectation is missing or mismatched.`,
      'critical',
      [contract.domain, String(contract.passed)],
      !contract.passed,
    ));
  }

  items.push(createItem(
    'contracts:backend-confirmation',
    'contracts',
    evidence.contracts.endpointContractConfirmation === 'confirmed'
      ? 'passed'
      : evidence.contracts.endpointContractConfirmation === 'failed'
        ? 'blocked'
        : 'pending',
    'backend contract confirmation',
    evidence.contracts.endpointContractConfirmation === 'confirmed'
      ? 'Backend contract confirmation has been recorded.'
      : evidence.contracts.endpointContractConfirmation === 'failed'
        ? 'Backend contract confirmation failed.'
        : 'Backend contract confirmation is not yet recorded.',
    'critical',
    [evidence.contracts.endpointContractConfirmation, evidence.contracts.backendOwnerConfirmationReference, evidence.contracts.backendOwnerConfirmationTimestamp],
    evidence.contracts.endpointContractConfirmation === 'failed',
  ));

  return items;
}

function evaluateRateLimitChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  items.push(createItem('rateLimits:policy-known', 'rateLimits', confirmedStatusToItemStatus(evidence.rateLimits.backendRateLimitPolicyKnown), 'backend rate-limit policy', evidence.rateLimits.backendRateLimitPolicyKnown === 'confirmed' ? 'Backend rate-limit policy is known.' : evidence.rateLimits.backendRateLimitPolicyKnown === 'failed' ? 'Backend rate-limit policy is not acceptable.' : 'Backend rate-limit policy is still unknown.', 'critical', [evidence.rateLimits.backendRateLimitPolicyKnown]));
  items.push(createItem('rateLimits:retry-after', 'rateLimits', confirmedStatusToItemStatus(evidence.rateLimits.retryAfterSupported), 'Retry-After support', evidence.rateLimits.retryAfterSupported === 'confirmed' ? 'Retry-After handling is supported.' : evidence.rateLimits.retryAfterSupported === 'failed' ? 'Retry-After handling is not supported.' : 'Retry-After support is still unknown.', 'warning', [evidence.rateLimits.retryAfterSupported]));
  items.push(createItem('rateLimits:staging-limits-known', 'rateLimits', confirmedStatusToItemStatus(evidence.rateLimits.stagingLimitsKnown), 'staging limits known', evidence.rateLimits.stagingLimitsKnown === 'confirmed' ? 'Staging limits are known.' : evidence.rateLimits.stagingLimitsKnown === 'failed' ? 'Staging limits are not known.' : 'Staging limits are still unknown.', 'critical', [evidence.rateLimits.stagingLimitsKnown]));
  return items;
}

function evaluateRollbackChecklist(evidence: StagingConnectionEvidence) {
  const items: StagingConnectionChecklistItem[] = [];
  items.push(createItem('rollback:default-local', 'rollback', booleanStatusToItemStatus(evidence.rollback.repositoryDefaultLocal), 'default repository local', evidence.rollback.repositoryDefaultLocal === true ? 'RepositoryResolver defaults to LOCAL.' : evidence.rollback.repositoryDefaultLocal === false ? 'RepositoryResolver default is not LOCAL.' : 'RepositoryResolver default is not yet confirmed.', 'critical', [String(evidence.rollback.repositoryDefaultLocal)]));
  items.push(createItem('rollback:invalid-config-local', 'rollback', booleanStatusToItemStatus(evidence.rollback.invalidConfigReturnsLocal), 'invalid config falls back local', evidence.rollback.invalidConfigReturnsLocal === true ? 'Invalid config falls back to LOCAL.' : evidence.rollback.invalidConfigReturnsLocal === false ? 'Invalid config does not fall back to LOCAL.' : 'Invalid config rollback is not yet confirmed.', 'critical', [String(evidence.rollback.invalidConfigReturnsLocal)]));
  items.push(createItem('rollback:missing-config-local', 'rollback', booleanStatusToItemStatus(evidence.rollback.missingConfigReturnsLocal), 'missing config falls back local', evidence.rollback.missingConfigReturnsLocal === true ? 'Missing config falls back to LOCAL.' : evidence.rollback.missingConfigReturnsLocal === false ? 'Missing config does not fall back to LOCAL.' : 'Missing config rollback is not yet confirmed.', 'critical', [String(evidence.rollback.missingConfigReturnsLocal)]));
  items.push(createItem('rollback:production-local', 'rollback', booleanStatusToItemStatus(evidence.rollback.productionReturnsLocal), 'production stays local', evidence.rollback.productionReturnsLocal === true ? 'Production stays on LOCAL.' : evidence.rollback.productionReturnsLocal === false ? 'Production does not stay on LOCAL.' : 'Production rollback semantics are not yet confirmed.', 'critical', [String(evidence.rollback.productionReturnsLocal)]));
  items.push(createItem('rollback:write-shadow-independent', 'rollback', booleanStatusToItemStatus(evidence.rollback.writeShadowIndependent), 'write shadow independent', evidence.rollback.writeShadowIndependent === true ? 'Write shadow is independently controlled.' : evidence.rollback.writeShadowIndependent === false ? 'Write shadow is not independently controlled.' : 'Write shadow independence is not yet confirmed.', 'critical', [String(evidence.rollback.writeShadowIndependent)]));
  items.push(createItem('rollback:env-flags-restore-local', 'rollback', booleanStatusToItemStatus(evidence.rollback.envFlagsRestoreLocal), 'env flags restore local', evidence.rollback.envFlagsRestoreLocal === true ? 'Clearing env flags restores LOCAL.' : evidence.rollback.envFlagsRestoreLocal === false ? 'Clearing env flags does not restore LOCAL.' : 'Env rollback semantics are not yet confirmed.', 'critical', [String(evidence.rollback.envFlagsRestoreLocal)]));
  items.push(createItem('rollback:restart-claim', 'rollback', evidence.rollback.restartRequirementClaimed === false ? 'passed' : 'pending', 'restart caveat', evidence.rollback.restartRequirementClaimed === true ? 'A runtime restart/build may be required after changing Expo public env vars.' : evidence.rollback.restartRequirementClaimed === false ? 'No incorrect restart claim is being made.' : 'Restart semantics are not yet confirmed.', 'warning', [String(evidence.rollback.restartRequirementClaimed)]));
  return items;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function computeOverallStatus(
  envStatus: ReturnType<typeof evaluateEnvironmentChecklist>,
  categories: StagingConnectionChecklistCategoryReport[],
): StagingConnectionOverallStatus {
  if (envStatus.overallEnvironmentStatus === 'not_configured') return 'not_configured';
  const allItems = categories.flatMap(category => category.items);
  const anyBlocked = allItems.some(item => item.status === 'blocked' || item.status === 'failed');
  if (anyBlocked) return 'blocked';
  const anyPending = allItems.some(item => item.status === 'pending' || item.status === 'unknown');
  if (anyPending) return 'pending_evidence';
  return 'ready_for_staging_shadow';
}

function computeRecommendedAction(status: StagingConnectionOverallStatus): StagingConnectionRecommendedAction {
  switch (status) {
    case 'not_configured':
      return 'configure_staging';
    case 'pending_evidence':
      return 'collect_backend_evidence';
    case 'blocked':
      return 'resolve_blockers';
    case 'ready_for_staging_shadow':
      return 'connect_staging_shadow';
    default:
      return 'hold';
  }
}

function buildPendingEvidence(items: StagingConnectionChecklistItem[]) {
  return dedupe(items.filter(item => item.status === 'pending' || item.status === 'unknown').map(item => `${item.category}:${item.key}`));
}

function buildCriticalBlockers(items: StagingConnectionChecklistItem[]) {
  return dedupe(items.filter(item => item.blocker || item.status === 'blocked' || item.status === 'failed').map(item => `${item.category}:${item.key} - ${item.details}`));
}

function buildWarnings(items: StagingConnectionChecklistItem[]) {
  return dedupe(items.filter(item => item.severity === 'warning' && (item.status === 'pending' || item.status === 'unknown' || item.status === 'passed')).map(item => `${item.category}:${item.key} - ${item.details}`));
}

function normalizeEvidenceFromOptions(options: StagingConnectionChecklistOptions): StagingConnectionEvidence {
  const loaded = options.evidencePath
    ? readJsonFileSafe<Partial<StagingConnectionEvidence>>(options.evidencePath)
    : defaultEvidence();
  return normalizeEvidence({ ...(loaded ?? {}), ...(options.evidence ?? {}) });
}

function normalizeManifestFromOptions(options: StagingConnectionChecklistOptions) {
  const loaded = options.manifestPath
    ? readJsonFileSafe<StagingBackendContractManifest>(options.manifestPath)
    : defaultManifest();
  return normalizeManifest({
    version: 1,
    domains: {
      ...(loaded?.domains ?? {}),
      ...(options.manifest?.domains ?? {}),
    },
  });
}

export async function evaluateStagingConnectionChecklist(options: StagingConnectionChecklistOptions = {}): Promise<StagingConnectionReport> {
  const env = options.env ?? readBackendTransportEnvironment();
  const evidence = normalizeEvidenceFromOptions(options);
  const manifest = normalizeManifestFromOptions(options);
  const domains = options.domains?.length ? options.domains : stagingConnectionDomains;
  const transportEvidence = await getTransportEvidence();

  const environmentStatus = evaluateEnvironmentChecklist(env, evidence);
  const transportItems = evaluateTransportChecklist(evidence).map(item => {
    if (item.key === 'transport:backend-client-bypass' && transportEvidence.repositoriesUseBackendClient === false) {
      return { ...item, status: 'failed' as const, blocker: true, details: 'Remote repositories do not consistently use BackendClient.' };
    }
    if (item.key === 'transport:backend-client' && transportEvidence.backendClientUsed === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:http-backend-transport' && transportEvidence.httpBackendTransportUsed === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:timeout-configured' && transportEvidence.timeoutConfigured === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:timeout-abort' && transportEvidence.timeoutAbortSupport === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:typed-errors' && transportEvidence.typedBackendErrorsExist === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:bounded-retry' && transportEvidence.retryPolicyBounded === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:get-retry' && transportEvidence.getRetrySafety === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:unsafe-write-retry' && transportEvidence.unsafeWriteRetryBlocked === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:idempotent-write-metadata' && transportEvidence.idempotentWriteMetadataSupported === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key === 'transport:malformed-json' && transportEvidence.malformedJsonMapsToSerializationError === false) {
      return { ...item, status: 'failed' as const };
    }
    if (item.key.startsWith('transport:status-')) {
      const statusKey = item.key.replace('transport:status-', '') as keyof typeof transportEvidence;
      if ((transportEvidence[statusKey] as boolean | undefined) === false) {
        return { ...item, status: 'failed' as const };
      }
    }
    return item;
  });

  const domainContracts = domains.map(domain => evaluateStagingDomainContract(domain, manifest ?? getExpectedStagingDomainContracts(), evidence));
  const authItems = evaluateAuthChecklist(evidence);
  const contractItems = evaluateContractsChecklist(domainContracts, evidence);
  const isolationItems = evaluateIsolationChecklist(evidence);
  const privacyItems = evaluatePrivacyChecklist(evidence);
  const observabilityItems = evaluateObservabilityChecklist(evidence);
  const resilienceItems = evaluateResilienceChecklist(evidence);
  const rateLimitItems = evaluateRateLimitChecklist(evidence);
  const rollbackItems = evaluateRollbackChecklist(evidence);

  const domainItems = domainContracts.flatMap(contract => evaluateDomainReadinessChecklist(contract.domain, contract, evidence, env));

  const allItems = [
    ...environmentStatus.items,
    ...transportItems,
    ...authItems,
    ...contractItems,
    ...isolationItems,
    ...privacyItems,
    ...observabilityItems,
    ...resilienceItems,
    ...rateLimitItems,
    ...rollbackItems,
    ...domainItems,
  ];

  const categories = stagingConnectionCategories.map(category => ({
    category,
    items: allItems.filter(item => item.category === category),
  }));

  const criticalBlockers = buildCriticalBlockers(allItems);
  const pendingEvidence = buildPendingEvidence(allItems);
  const warnings = buildWarnings(allItems);
  const domainReports: StagingConnectionDomainReport[] = domainContracts.map(contract => {
    const readinessItem = domainItems.find(item => item.key === `domain:${contract.domain}`) ?? null;
    return {
      domain: contract.domain,
      contract,
      readiness: readinessItem?.status ?? 'unknown',
      blockers: dedupe([
        ...contract.contractBlockers,
        ...domainItems
          .filter(item => item.key === `domain:${contract.domain}` && isFailureStatus(item.status))
          .map(item => item.details),
      ]),
      warnings: dedupe([
        ...contract.warnings,
        ...domainItems
          .filter(item => item.key === `domain:${contract.domain}` && (item.status === 'pending' || item.status === 'unknown' || item.status === 'passed'))
          .map(item => item.details),
      ]),
    };
  });

  const overallStatus = computeOverallStatus(environmentStatus, categories);
  const strictViolations = overallStatus === 'blocked' ? criticalBlockers : [];

  const report: StagingConnectionReport = {
    generatedAt: nowIso(options.now ?? new Date()),
    overallStatus,
    recommendedAction: computeRecommendedAction(overallStatus),
    checklistCategories: categories,
    domains: domainReports,
    domainContractStatus: domainContracts as StagingConnectionDomainContractStatus[],
    criticalBlockers,
    pendingEvidence,
    warnings,
    strictViolations,
    manifestPath: options.manifestPath ?? defaultManifestPath,
    evidencePath: options.evidencePath ?? defaultEvidencePath,
  };

  return report;
}

export async function getDefaultStagingConnectionEvidence() {
  return normalizeEvidence(defaultEvidence() ?? {});
}

export async function getDefaultStagingConnectionManifest() {
  return normalizeManifest(defaultManifest() ?? { version: 1, domains: {} });
}

export async function evaluateCurrentStagingConnectionChecklist() {
  return evaluateStagingConnectionChecklist();
}
