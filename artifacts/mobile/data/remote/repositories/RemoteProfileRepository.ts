import type { ProfileRepository } from '@/data/repositories/interfaces';
import type { ProfilePhoto, ProfilePreferences, UserProfile } from '@/domains/profile';
import type { User } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { createBackendUnavailableError, BackendError } from '../contracts/backendErrors';
import type { StagingShadowHealthEvent } from '../staging/health';
import type {
  ChangePhoneRequestDto,
  ChangePhoneResponseDto,
  GetProfileResponseDto,
  ProfileDto,
  UpdateProfileRequestDto,
  UpdateProfileResponseDto,
  UploadProfilePhotoRequestDto,
  UploadProfilePhotoResponseDto,
} from '../contracts/api';
import {
  changePhoneRequestToDto,
  dtoToDomainProfile,
  domainToDtoProfile,
  domainToProfilePhotoDto,
} from '../mappers/profileMapper';

export interface RemoteProfileRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface ProfileShadowRepositoryOptions {
  localRepository: ProfileRepository;
  remoteRepository: RemoteProfileRepository;
  shadowWritesEnabled?: boolean;
  healthRecorder?: (event: StagingShadowHealthEvent) => void;
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function extractProfileSemantics(profile: UserProfile | null | undefined) {
  if (!profile) return null;
  return {
    userId: profile.userId,
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    email: profile.email ?? null,
    profilePhoto: profile.profilePhoto?.uri ?? null,
    preferredLanguage: profile.preferredLanguage ?? null,
    notificationPreferences: profile.notificationPreferences ?? null,
  };
}

function recordTelemetry(
  event: 'profile remote shadow request' | 'profile remote shadow success' | 'profile remote shadow failure' | 'profile staging shadow request' | 'profile staging shadow success' | 'profile staging shadow failure' | 'profile staging shadow skipped' | 'profile semantic mismatch',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    statusClass?: string;
    mismatchCategory?: string;
    fieldCategory?: string;
    correlationId?: string;
    error?: unknown;
  },
) {
  observability.metrics.counter('profile.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('profile.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('ProfileRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    statusClass: context.statusClass,
    mismatchCategory: context.mismatchCategory,
    fieldCategory: context.fieldCategory,
    correlationId: context.correlationId,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function emitProfileStagingTelemetry(
  event: 'profile staging shadow request' | 'profile staging shadow success' | 'profile staging shadow failure' | 'profile staging shadow skipped' | 'profile semantic mismatch',
  context: {
    method: string;
    latencyMs?: number;
    statusClass?: string;
    mismatchCategory?: string;
    fieldCategory?: string;
    correlationId?: string;
    error?: unknown;
  },
) {
  observability.metrics.counter('profile.staging.shadow', 1, {
    method: context.method,
    event,
    statusClass: context.statusClass ?? 'none',
    mismatchCategory: context.mismatchCategory ?? 'none',
    fieldCategory: context.fieldCategory ?? 'none',
  });
  if (typeof context.latencyMs === 'number') {
    observability.metrics.histogram('profile.staging.shadow.latency_ms', context.latencyMs, {
      method: context.method,
      event,
    });
  }
  observability.logger.info('ProfileStagingShadow', {
    event,
    method: context.method,
    latencyMs: context.latencyMs,
    statusClass: context.statusClass,
    mismatchCategory: context.mismatchCategory,
    fieldCategory: context.fieldCategory,
    correlationId: context.correlationId,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function extractStatusClass(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (typeof status === 'number' && Number.isFinite(status)) {
      return `${Math.floor(status / 100)}xx`;
    }
  }
  return 'none';
}

function classifyProfileSemantics(profile: UserProfile | null | undefined) {
  if (!profile) return { exists: false, displayName: 'missing', language: 'missing', photo: 'missing', phone: 'missing' as const };
  return {
    exists: true,
    displayName: profile.fullName.trim() ? 'present' : 'missing',
    language: profile.preferredLanguage?.trim() ? 'present' : 'missing',
    photo: profile.profilePhoto?.uri?.trim() ? 'present' : 'missing',
    phone: profile.phoneNumber.trim() ? 'present' : 'missing',
  };
}

function classifyProfileMismatch(local: UserProfile | null | undefined, remote: UserProfile | null | undefined) {
  const localSemantics = classifyProfileSemantics(local);
  const remoteSemantics = classifyProfileSemantics(remote);
  if (localSemantics.exists !== remoteSemantics.exists) return 'existence';
  if (localSemantics.displayName !== remoteSemantics.displayName) return 'display_name';
  if (localSemantics.language !== remoteSemantics.language) return 'language';
  if (localSemantics.photo !== remoteSemantics.photo) return 'photo';
  if (localSemantics.phone !== remoteSemantics.phone) return 'phone';
  return null;
}

function toRepositoryFailure(method: string, error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  return createBackendUnavailableError('profile', method, 'remote');
}

function normalizeProfileUpdate(
  current: UserProfile | null | undefined,
  updates: Partial<User> | Partial<UserProfile>,
): UserProfile {
  const fullName =
    'fullName' in updates && typeof updates.fullName === 'string'
      ? updates.fullName
      : 'name' in updates && typeof updates.name === 'string'
        ? updates.name
        : current?.fullName ?? '';
  const phoneNumber =
    'phoneNumber' in updates && typeof updates.phoneNumber === 'string'
      ? updates.phoneNumber
      : 'phone' in updates && typeof updates.phone === 'string'
        ? updates.phone
        : current?.phoneNumber ?? '';
  const profilePhoto = 'profilePhoto' in updates && updates.profilePhoto ? updates.profilePhoto : current?.profilePhoto ?? null;
  const email = 'email' in updates && typeof updates.email === 'string' ? updates.email : current?.email;

  return {
    userId: current?.userId ?? 'unknown',
    fullName,
    phoneNumber,
    email,
    profilePhoto,
    preferredLanguage: current?.preferredLanguage,
    notificationPreferences: current?.notificationPreferences,
    mode: current?.mode,
    isDriver: current?.isDriver,
    createdAt: current?.createdAt,
    preferences: current?.preferences,
  };
}

export class RemoteProfileRepository implements ProfileRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteProfileRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('profile remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('profile remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('profile remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(method, error);
    }
  }

  async getCurrentProfile(current?: UserProfile | null): Promise<UserProfile | null> {
    return this.shadow('getCurrentProfile', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'getCurrentProfile', 'remote');
      const response = await this.client.get<GetProfileResponseDto>('/v1/profile/me');
      return dtoToDomainProfile(response.data.data, current ?? null);
    });
  }

  async updateProfile(
    updates: Partial<User> | Partial<UserProfile>,
    metadata: UpdateProfileRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null> {
    return this.shadow('updateProfile', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'updateProfile', 'remote');
      const request = domainToDtoProfile(normalizeProfileUpdate(current, updates), metadata);
      const response = await this.client.patch<UpdateProfileResponseDto>('/v1/profile/me', {
        body: request,
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
      });
      return dtoToDomainProfile(response.data.data, current ?? null);
    });
  }

  async getProfilePhoto(current?: UserProfile | null): Promise<ProfilePhoto | null> {
    const profile = await this.getCurrentProfile(current);
    return profile?.profilePhoto ?? null;
  }

  async uploadProfilePhoto(
    uri: string,
    metadata: UploadProfilePhotoRequestDto,
    current?: UserProfile | null,
  ): Promise<ProfilePhoto | null> {
    return this.shadow('uploadProfilePhoto', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'uploadProfilePhoto', 'remote');
      const photoDto = domainToProfilePhotoDto(uri, metadata);
      const response = await this.client.post<UploadProfilePhotoResponseDto>('/v1/profile/me/photo', {
        body: photoDto,
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
      });
      const profile = current ?? null;
      if (response.data?.data?.photoUrl) {
        return { uri: response.data.data.photoUrl } satisfies ProfilePhoto;
      }
      return profile?.profilePhoto ?? null;
    });
  }

  async updatePhoneNumber(
    phoneNumber: string,
    otp: string,
    metadata: ChangePhoneRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null> {
    return this.shadow('updatePhoneNumber', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'updatePhoneNumber', 'remote');
      const request = changePhoneRequestToDto(phoneNumber, otp, metadata);
      const response = await this.client.patch<ChangePhoneResponseDto>('/v1/profile/me/phone', {
        body: request,
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
      });
      return dtoToDomainProfile(response.data.data, current ?? null);
    });
  }

  async updatePreferences(
    preferences: ProfilePreferences,
    metadata: UpdateProfileRequestDto,
    current?: UserProfile | null,
  ): Promise<UserProfile | null> {
    return this.shadow('updatePreferences', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'updatePreferences', 'remote');
      const request = domainToDtoProfile(
        {
          ...(current ?? {
            userId: 'unknown',
            fullName: '',
            phoneNumber: '',
          }),
          preferences: {
            ...(current?.preferences ?? {}),
            ...preferences,
          },
        } as UserProfile,
        metadata,
      );
      const response = await this.client.patch<UpdateProfileResponseDto>('/v1/profile/me', {
        body: request,
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
      });
      return dtoToDomainProfile(response.data.data, current ?? null);
    });
  }

  async getProfileImage(): Promise<string | null> {
    const photo = await this.getProfilePhoto();
    return photo?.uri ?? null;
  }

  async saveProfileImage(uri: string): Promise<void> {
    await this.uploadProfilePhoto(uri, {
      idempotencyKey: `profile:photo:${uri}`,
      correlationId: `profile:photo:${uri}`,
      actorId: uri,
      actorRole: 'customer',
      clientTimestamp: new Date().toISOString(),
      fileName: uri.split('/').pop() ?? 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 0,
    });
  }

  async removeProfileImage(): Promise<void> {
    await this.shadow('removeProfileImage', async () => {
      if (!this.client) throw createBackendUnavailableError('profile', 'removeProfileImage', 'remote');
      await this.client.patch<UpdateProfileResponseDto>('/v1/profile/me', {
        body: {
          idempotencyKey: 'profile:photo:remove',
          correlationId: 'profile:photo:remove',
          actorId: 'profile',
          actorRole: 'customer',
          clientTimestamp: new Date().toISOString(),
          photoUrl: null,
        },
        headers: {
          'X-Correlation-Id': 'profile:photo:remove',
          'X-Idempotency-Key': 'profile:photo:remove',
        },
      });
    });
  }
}

export function createRemoteProfileRepository(options: RemoteProfileRepositoryOptions = {}) {
  return new RemoteProfileRepository(options);
}

export function createProfileShadowRepository(options: ProfileShadowRepositoryOptions) {
  const { localRepository, remoteRepository, shadowWritesEnabled = true, healthRecorder } = options;

  function recordHealth(event: StagingShadowHealthEvent) {
    healthRecorder?.(event);
  }

  function withDomain(event: StagingShadowHealthEvent['event'], operation: string, extras: Partial<StagingShadowHealthEvent> = {}) {
    recordHealth({
      domain: 'profile',
      operation,
      event,
      ...extras,
    });
  }

  async function shadowRead<T>(method: string, local: () => Promise<T>, remote: () => Promise<T>, compare: (localValue: T, remoteValue: T) => string | null) {
    const localStartedAt = Date.now();
    const localValue = await local();
    withDomain('local_operation_completed', method, {
      latencyMs: Date.now() - localStartedAt,
      fieldCategory: 'read',
    });
    emitProfileStagingTelemetry('profile staging shadow request', {
      method,
      latencyMs: Date.now() - localStartedAt,
      fieldCategory: 'read',
    });
    withDomain('shadow_attempted', method, { fieldCategory: 'read' });
    const remoteStartedAt = Date.now();
    try {
      const remoteValue = await remote();
      withDomain('shadow_success', method, {
        latencyMs: Date.now() - remoteStartedAt,
        fieldCategory: 'read',
      });
      const mismatchCategory = compare(localValue, remoteValue);
      emitProfileStagingTelemetry('profile staging shadow success', {
        method,
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: '2xx',
        mismatchCategory: mismatchCategory ?? 'none',
        fieldCategory: 'read',
      });
      if (mismatchCategory) {
        withDomain('semantic_mismatch', method, {
          mismatchCategory,
          fieldCategory: 'read',
        });
        emitProfileStagingTelemetry('profile semantic mismatch', {
          method,
          mismatchCategory,
          fieldCategory: 'read',
        });
        observability.metrics.counter('profile.remote.shape_mismatch', 1, { method, mismatchCategory });
        observability.logger.warn('ProfileRemoteShadowMismatch', {
          method,
          mismatchCategory,
          localShape: summarizeShape(localValue),
          remoteShape: summarizeShape(remoteValue),
        });
      }
    } catch (error) {
      withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', method, {
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: extractStatusClass(error),
        fieldCategory: 'read',
        errorCategory: error instanceof Error ? error.name : 'unknown',
      });
      emitProfileStagingTelemetry('profile staging shadow failure', {
        method,
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: extractStatusClass(error),
        fieldCategory: 'read',
        error,
      });
      observability.logger.warn('ProfileRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  async function shadowWrite<T>(
    method: string,
    local: () => Promise<T>,
    remote: () => Promise<T>,
    fieldCategory: string,
    compare: (localValue: T, remoteValue: T) => string | null = () => null,
  ) {
    const localStartedAt = Date.now();
    emitProfileStagingTelemetry('profile staging shadow request', {
      method,
      fieldCategory,
    });
    const localValue = await local();
    withDomain('local_operation_completed', method, {
      latencyMs: Date.now() - localStartedAt,
      fieldCategory,
    });
    if (!shadowWritesEnabled) {
      withDomain('skipped_write_shadow_disabled', method, {
        fieldCategory,
      });
      emitProfileStagingTelemetry('profile staging shadow skipped', {
        method,
        fieldCategory,
      });
      return localValue;
    }
    withDomain('shadow_attempted', method, { fieldCategory });
    const remoteStartedAt = Date.now();
    try {
      const remoteValue = await remote();
      withDomain('shadow_success', method, {
        latencyMs: Date.now() - remoteStartedAt,
        fieldCategory,
      });
      const mismatchCategory = compare(localValue, remoteValue);
      emitProfileStagingTelemetry('profile staging shadow success', {
        method,
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: '2xx',
        mismatchCategory: mismatchCategory ?? 'none',
        fieldCategory,
      });
      if (mismatchCategory) {
        withDomain('semantic_mismatch', method, {
          mismatchCategory,
          fieldCategory,
        });
        emitProfileStagingTelemetry('profile semantic mismatch', {
          method,
          mismatchCategory,
          fieldCategory,
        });
      }
    } catch (error) {
      withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', method, {
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: extractStatusClass(error),
        fieldCategory,
        errorCategory: error instanceof Error ? error.name : 'unknown',
      });
      emitProfileStagingTelemetry('profile staging shadow failure', {
        method,
        latencyMs: Date.now() - remoteStartedAt,
        statusClass: extractStatusClass(error),
        fieldCategory,
        error,
      });
      observability.logger.warn('ProfileRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  const repository = {
    async getProfileImage() {
      return shadowRead(
        'getProfileImage',
        () => localRepository.getProfileImage(),
        () => remoteRepository.getProfileImage(),
        (localValue, remoteValue) => {
          if (localValue === remoteValue) return null;
          return 'photo';
        },
      );
    },
    async saveProfileImage(uri: string) {
      return shadowWrite(
        'saveProfileImage',
        () => localRepository.saveProfileImage(uri),
        () => remoteRepository.saveProfileImage(uri),
        'photo',
      );
    },
    async removeProfileImage() {
      return shadowWrite(
        'removeProfileImage',
        () => localRepository.removeProfileImage(),
        () => remoteRepository.removeProfileImage(),
        'photo',
      );
    },
    async getCurrentProfile(current?: UserProfile | null) {
      const local = current ?? null;
      return shadowRead(
        'getCurrentProfile',
        async () => local,
        () => remoteRepository.getCurrentProfile(current ?? null),
        (localValue, remoteValue) => classifyProfileMismatch(localValue, remoteValue),
      );
    },
    async updateProfile(
      updates: Partial<User> | Partial<UserProfile>,
      metadata: UpdateProfileRequestDto,
      current?: UserProfile | null,
    ) {
      const local = current ?? null;
      return shadowWrite(
        'updateProfile',
        async () => local,
        () => remoteRepository.updateProfile(updates, metadata, current ?? null),
        'profile',
        (localValue, remoteValue) => classifyProfileMismatch(localValue, remoteValue),
      );
    },
    async uploadProfilePhoto(
      uri: string,
      metadata: UploadProfilePhotoRequestDto,
      current?: UserProfile | null,
    ) {
      const local = current?.profilePhoto ?? null;
      return shadowWrite(
        'uploadProfilePhoto',
        async () => local,
        () => remoteRepository.uploadProfilePhoto(uri, metadata, current ?? null),
        'photo',
        (localValue, remoteValue) => {
          const localUri = localValue?.uri ?? null;
          const remoteUri = remoteValue?.uri ?? null;
          return localUri === remoteUri ? null : 'photo';
        },
      );
    },
    async updatePhoneNumber(
      phoneNumber: string,
      otp: string,
      metadata: ChangePhoneRequestDto,
      current?: UserProfile | null,
    ) {
      const local = current ?? null;
      return shadowWrite(
        'updatePhoneNumber',
        async () => local,
        () => remoteRepository.updatePhoneNumber(phoneNumber, otp, metadata, current ?? null),
        'phone',
        (localValue, remoteValue) => classifyProfileMismatch(localValue, remoteValue),
      );
    },
    async updatePreferences(
      preferences: ProfilePreferences,
      metadata: UpdateProfileRequestDto,
      current?: UserProfile | null,
    ) {
      const local = current ?? null;
      return shadowWrite(
        'updatePreferences',
        async () => local,
        () => remoteRepository.updatePreferences(preferences, metadata, current ?? null),
        'preference',
        (localValue, remoteValue) => classifyProfileMismatch(localValue, remoteValue),
      );
    },
  };

  return repository satisfies ProfileRepository & {
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
  };
}
