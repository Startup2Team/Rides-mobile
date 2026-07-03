import type { ProfileRepository } from '@/data/repositories/interfaces';
import type { ProfilePhoto, ProfilePreferences, UserProfile } from '@/domains/profile';
import type { User } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { createHttpBackendTransport } from '../transport/httpBackendTransport';
import { readBackendTransportEnvironment, resolveBackendTransportConfig, validateBackendBaseUrl } from '../transport/backendTransportConfig';
import type { BackendTransportEnvironment, HttpBackendTransportConfig } from '../transport/httpBackendTransportTypes';
import { RemoteProfileRepository, createProfileShadowRepository } from '../repositories/RemoteProfileRepository';
import type { ChangePhoneRequestDto, UpdateProfileRequestDto, UploadProfilePhotoRequestDto } from '../contracts/api';

export type ProfileRepositoryMode = 'LOCAL' | 'SHADOW_REMOTE';

export interface ProfileStagingShadowFactoryOptions {
  localRepository: ProfileRepository;
  env?: BackendTransportEnvironment;
  fetchImpl?: HttpBackendTransportConfig['fetchImpl'];
  tokenProvider?: HttpBackendTransportConfig['tokenProvider'];
  timeoutMs?: number;
}

export interface ProfileStagingShadowResolution {
  repository: ProfileStagingShadowRepository;
  mode: ProfileRepositoryMode;
  reason?: string;
}

export interface ProfileStagingShadowRepository extends ProfileRepository {
  getCurrentProfile(current?: UserProfile | null): Promise<UserProfile | null>;
  updateProfile(
    updates: Partial<User> | Partial<UserProfile>,
    metadata: UpdateProfileRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null>;
  uploadProfilePhoto(
    uri: string,
    metadata: UploadProfilePhotoRequestDto,
    current?: UserProfile | null,
  ): Promise<ProfilePhoto | null>;
  updatePhoneNumber(
    phoneNumber: string,
    otp: string,
    metadata: ChangePhoneRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null>;
  updatePreferences(
    preferences: ProfilePreferences,
    metadata: UpdateProfileRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null>;
}

function emitConfigSkipped(reason: string) {
  observability.metrics.counter('profile.staging.shadow.config', 1, {
    result: 'skipped',
    reason,
  });
  observability.logger.info('ProfileStagingShadowConfig', {
    result: 'skipped',
    reason,
  });
}

function normalizeRepositoryMode(value?: string): ProfileRepositoryMode {
  return value?.trim().toUpperCase() === 'SHADOW_REMOTE' ? 'SHADOW_REMOTE' : 'LOCAL';
}

function shadowWritesEnabled(env: BackendTransportEnvironment) {
  return env.profileShadowWritesEnabled?.trim().toLowerCase() === 'true';
}

function isProductionRuntime(env: BackendTransportEnvironment) {
  return env.nodeEnv === 'production';
}

function createLocalOnlyProfileStagingRepository(localRepository: ProfileRepository): ProfileStagingShadowRepository {
  return {
    async getProfileImage() {
      return localRepository.getProfileImage();
    },
    async saveProfileImage(uri: string) {
      return localRepository.saveProfileImage(uri);
    },
    async removeProfileImage() {
      return localRepository.removeProfileImage();
    },
    async getCurrentProfile(current?: UserProfile | null) {
      return current ?? null;
    },
    async updateProfile(
      _updates: Partial<User> | Partial<UserProfile>,
      _metadata: UpdateProfileRequestDto,
      current?: UserProfile | null,
    ) {
      return current ?? null;
    },
    async uploadProfilePhoto(
      _uri: string,
      _metadata: UploadProfilePhotoRequestDto,
      current?: UserProfile | null,
    ) {
      return current?.profilePhoto ?? null;
    },
    async updatePhoneNumber(
      _phoneNumber: string,
      _otp: string,
      _metadata: ChangePhoneRequestDto,
      current?: UserProfile | null,
    ) {
      return current ?? null;
    },
    async updatePreferences(
      _preferences: ProfilePreferences,
      _metadata: UpdateProfileRequestDto,
      current?: UserProfile | null,
    ) {
      return current ?? null;
    },
  };
}

export function resolveProfileStagingShadowConfig(
  env: BackendTransportEnvironment = readBackendTransportEnvironment(),
) {
  const mode = normalizeRepositoryMode(env.profileRepositoryMode);
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

export function createProfileStagingShadowRepository(
  options: ProfileStagingShadowFactoryOptions,
): ProfileStagingShadowResolution {
  const env = options.env ?? readBackendTransportEnvironment();
  const resolved = resolveProfileStagingShadowConfig(env);

  if (!resolved.enabled) {
    emitConfigSkipped(resolved.reason);
    return {
      repository: createLocalOnlyProfileStagingRepository(options.localRepository),
      mode: 'LOCAL',
      reason: resolved.reason,
    };
  }

  const transport = createHttpBackendTransport({
    baseUrl: resolved.backendConfig.baseUrl,
    timeoutMs: options.timeoutMs ?? resolved.backendConfig.timeoutMs,
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
  const remoteRepository = new RemoteProfileRepository({
    client,
    transportLabel: 'shadow_remote',
  });

  return {
    repository: createProfileShadowRepository({
      localRepository: options.localRepository,
      remoteRepository,
      shadowWritesEnabled: resolved.shadowWritesEnabled,
    }),
    mode: 'SHADOW_REMOTE',
  };
}
