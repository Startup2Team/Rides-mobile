import { BackendError } from '../contracts/backendErrors';
import {
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import type { ChangePhoneRequestDto, ProfileDto, UpdateProfileRequestDto, UploadProfilePhotoRequestDto } from '../contracts/api';
import type { ProfileIdentity, ProfilePhoto, UserProfile } from '@/domains/profile';
import type { User } from '@/types';

export function dtoToDomainProfile(dto: ProfileDto, current?: UserProfile | null): UserProfile {
  const profilePhoto = dto.photoUrl ? { uri: dto.photoUrl } satisfies ProfilePhoto : current?.profilePhoto ?? null;
  return {
    userId: dto.id,
    fullName: dto.displayName,
    phoneNumber: dto.phoneNumber,
    email: current?.email,
    profilePhoto,
    preferredLanguage: current?.preferredLanguage,
    notificationPreferences: current?.notificationPreferences,
    mode: current?.mode,
    isDriver: current?.isDriver,
    createdAt: current?.createdAt,
    preferences: current?.preferences,
  };
}

export function profileIdentityToDto(identity: ProfileIdentity): ProfileDto {
  return {
    id: identity.userId,
    displayName: identity.fullName,
    phoneNumber: identity.phoneNumber,
    photoUrl: identity.profilePhoto?.uri ?? null,
  };
}

export function domainToDtoProfile(domain: Partial<User> | UserProfile, metadata: UpdateProfileRequestDto): UpdateProfileRequestDto {
  const fullName =
    'fullName' in domain && typeof domain.fullName === 'string'
      ? domain.fullName
      : 'name' in domain && typeof domain.name === 'string'
        ? domain.name
        : metadata.displayName ?? null;
  const phoneNumber =
    'phoneNumber' in domain && typeof domain.phoneNumber === 'string'
      ? domain.phoneNumber
      : 'phone' in domain && typeof domain.phone === 'string'
        ? domain.phone
        : metadata.phoneNumber ?? null;
  const photoUrl = 'profilePhoto' in domain && domain.profilePhoto ? domain.profilePhoto.uri ?? null : metadata.photoUrl ?? null;
  const request: UpdateProfileRequestDto = {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    displayName: fullName,
    phoneNumber,
    photoUrl,
  };
  return request;
}

export function domainToProfilePhotoDto(uri: string | null, metadata: UploadProfilePhotoRequestDto): UploadProfilePhotoRequestDto {
  void uri;
  const request: UploadProfilePhotoRequestDto = {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize,
  };
  return request;
}

export function changePhoneRequestToDto(phoneNumber: string, otp: string, metadata: ChangePhoneRequestDto): ChangePhoneRequestDto {
  const request: ChangePhoneRequestDto = {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    phoneNumber,
    otp,
  };
  return request;
}

export function dtoPhotoUrlToProfilePhoto(photoUrl: string | null | undefined): ProfilePhoto | null {
  return photoUrl ? { uri: photoUrl } : null;
}

export function errorToRepositoryFailureProfile(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'profile', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('profile', 'errorToRepositoryFailure', 'mapper');
}

export function toProfileRepositoryFailure(error: unknown) {
  return errorToRepositoryFailureProfile(error);
}
