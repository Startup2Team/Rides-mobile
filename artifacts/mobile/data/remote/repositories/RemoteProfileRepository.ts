import type { ProfileRepository } from '@/data/repositories/interfaces';
import type { ProfilePhoto, ProfilePreferences, UserProfile } from '@/domains/profile';
import type { User } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { createBackendUnavailableError, BackendError } from '../contracts/backendErrors';
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

function hasSemanticMismatch(local: unknown, remote: unknown) {
  if (local === remote) return false;
  if (typeof local !== typeof remote) return true;
  if (local && remote && typeof local === 'object' && typeof remote === 'object') {
    return JSON.stringify(local) !== JSON.stringify(remote);
  }
  return local !== remote;
}

function recordTelemetry(
  event: 'profile remote shadow request' | 'profile remote shadow success' | 'profile remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
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
    error: context.error instanceof Error ? context.error.name : undefined,
  });
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
      });
    });
  }
}

export function createRemoteProfileRepository(options: RemoteProfileRepositoryOptions = {}) {
  return new RemoteProfileRepository(options);
}

export function createProfileShadowRepository(options: {
  localRepository: ProfileRepository;
  remoteRepository: RemoteProfileRepository;
}) {
  const { localRepository, remoteRepository } = options;

  return {
    async getProfileImage() {
      const local = await localRepository.getProfileImage();
      try {
        const remote = await remoteRepository.getProfileImage();
        if (hasSemanticMismatch(local, remote)) {
          observability.metrics.counter('profile.remote.shape_mismatch', 1, { method: 'getProfileImage' });
          observability.logger.warn('ProfileRemoteShadowMismatch', {
            method: 'getProfileImage',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
          });
        }
      } catch (error) {
        observability.logger.warn('ProfileRemoteShadowFailure', {
          method: 'getProfileImage',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async saveProfileImage(uri: string) {
      await localRepository.saveProfileImage(uri);
      try {
        await remoteRepository.saveProfileImage(uri);
      } catch (error) {
        observability.logger.warn('ProfileRemoteShadowFailure', {
          method: 'saveProfileImage',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async removeProfileImage() {
      await localRepository.removeProfileImage();
      try {
        await remoteRepository.removeProfileImage();
      } catch (error) {
        observability.logger.warn('ProfileRemoteShadowFailure', {
          method: 'removeProfileImage',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async getCurrentProfile(current?: UserProfile | null) {
      const local = current ?? null;
      try {
        const remote = await remoteRepository.getCurrentProfile(current ?? null);
        if (hasSemanticMismatch(extractProfileSemantics(local), extractProfileSemantics(remote))) {
          observability.metrics.counter('profile.remote.shape_mismatch', 1, { method: 'getCurrentProfile' });
          observability.logger.warn('ProfileRemoteShadowMismatch', {
            method: 'getCurrentProfile',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
          });
        }
      } catch (error) {
        observability.logger.warn('ProfileRemoteShadowFailure', {
          method: 'getCurrentProfile',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
  } satisfies ProfileRepository & {
    getCurrentProfile(current?: UserProfile | null): Promise<UserProfile | null>;
  };
}
