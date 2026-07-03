import type { SavedLocationsRepository } from '@/data/repositories/interfaces';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { RemoteSavedLocationsRepository, createSavedLocationsShadowRepository } from '../repositories/RemoteSavedLocationsRepository';
import { createHttpBackendTransport } from '../transport/httpBackendTransport';
import { readBackendTransportEnvironment, resolveBackendTransportConfig, validateBackendBaseUrl } from '../transport/backendTransportConfig';
import type { BackendTransportEnvironment, HttpBackendTransportConfig } from '../transport/httpBackendTransportTypes';

export type SavedLocationsRepositoryMode = 'LOCAL' | 'SHADOW_REMOTE';

export interface SavedLocationsStagingShadowFactoryOptions {
  localRepository: SavedLocationsRepository;
  env?: BackendTransportEnvironment;
  fetchImpl?: HttpBackendTransportConfig['fetchImpl'];
  tokenProvider?: HttpBackendTransportConfig['tokenProvider'];
}

export interface SavedLocationsStagingShadowResolution {
  repository: SavedLocationsRepository;
  mode: SavedLocationsRepositoryMode;
  reason?: string;
}

function emitConfigSkipped(reason: string) {
  observability.metrics.counter('saved_locations.staging_shadow.config', 1, {
    result: 'skipped',
    reason,
  });
  observability.logger.info('SavedLocationsStagingShadowConfig', {
    result: 'skipped',
    reason,
  });
}

function normalizeSavedLocationsMode(value?: string): SavedLocationsRepositoryMode {
  return value?.trim().toUpperCase() === 'SHADOW_REMOTE' ? 'SHADOW_REMOTE' : 'LOCAL';
}

function shadowWritesEnabled(env: BackendTransportEnvironment) {
  return env.savedLocationsShadowWritesEnabled?.trim().toLowerCase() === 'true';
}

function isProductionRuntime(env: BackendTransportEnvironment) {
  return env.nodeEnv === 'production';
}

export function resolveSavedLocationsStagingShadowConfig(
  env: BackendTransportEnvironment = readBackendTransportEnvironment(),
) {
  const mode = normalizeSavedLocationsMode(env.savedLocationsRepositoryMode);
  if (mode !== 'SHADOW_REMOTE') return { enabled: false as const, mode: 'LOCAL' as const, reason: 'repository-mode-local' };
  if (isProductionRuntime(env)) return { enabled: false as const, mode: 'LOCAL' as const, reason: 'production-shadow-disabled' };

  const backendConfig = resolveBackendTransportConfig(env);
  if (!backendConfig.enabled || backendConfig.environment !== 'STAGING' || !backendConfig.baseUrl) {
    return {
      enabled: false as const,
      mode: 'LOCAL' as const,
      reason: backendConfig.reason ?? 'backend-not-staging',
    };
  }

  const validated = validateBackendBaseUrl(backendConfig.baseUrl, 'STAGING');
  if (!validated.ok) {
    return { enabled: false as const, mode: 'LOCAL' as const, reason: validated.reason };
  }

  return {
    enabled: true as const,
    mode: 'SHADOW_REMOTE' as const,
    backendConfig: {
      ...backendConfig,
      baseUrl: validated.url,
    },
    shadowWritesEnabled: !isProductionRuntime(env) && shadowWritesEnabled(env),
  };
}

export function createSavedLocationsStagingShadowRepository(
  options: SavedLocationsStagingShadowFactoryOptions,
): SavedLocationsStagingShadowResolution {
  const env = options.env ?? readBackendTransportEnvironment();
  const resolved = resolveSavedLocationsStagingShadowConfig(env);

  if (!resolved.enabled) {
    emitConfigSkipped(resolved.reason);
    return {
      repository: options.localRepository,
      mode: 'LOCAL',
      reason: resolved.reason,
    };
  }

  const transport = createHttpBackendTransport({
    baseUrl: resolved.backendConfig.baseUrl,
    timeoutMs: resolved.backendConfig.timeoutMs,
    fetchImpl: options.fetchImpl,
    tokenProvider: options.tokenProvider,
    clientMetadata: {
      'X-Rides-Backend-Environment': 'staging',
      'X-Rides-Client-Platform': 'mobile',
      'X-Rides-Api-Version': 'v1',
    },
  });
  const client = new BackendClient({
    baseUrl: resolved.backendConfig.baseUrl,
    transport,
  });
  const remoteRepository = new RemoteSavedLocationsRepository({
    client,
    transportLabel: 'shadow_remote',
  });

  return {
    repository: createSavedLocationsShadowRepository({
      localRepository: options.localRepository,
      remoteRepository,
      shadowWritesEnabled: resolved.shadowWritesEnabled,
    }),
    mode: 'SHADOW_REMOTE',
  };
}
