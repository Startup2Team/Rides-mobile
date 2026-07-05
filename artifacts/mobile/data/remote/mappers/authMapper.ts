import type { User } from '@/types';
import {
  BackendError,
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
import type {
  AuthUserDto,
  CurrentSessionResponseDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  RefreshSessionResponseDto,
  RequestOtpRequestDto,
  RequestOtpResponseDto,
  VerifyOtpRequestDto,
  VerifyOtpResponseDto,
} from '../contracts/api';
import type { ApiIdempotencyMetadata } from '../contracts/api/shared';

export interface AuthOtpRequestInput {
  phoneNumber: string;
  channel?: 'sms' | 'whatsapp' | 'voice';
}

export interface AuthOtpRequestResult {
  requestId: string;
  maskedPhoneNumber: string;
  expiresAt: string;
}

export interface AuthVerifyOtpInput extends AuthOtpRequestInput {
  otp: string;
}

export interface AuthSessionDomain {
  user: User | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthCurrentSessionDomain {
  user: User | null;
  expiresAt: string | null;
}

export function dtoToDomainAuthUser(dto: AuthUserDto | null | undefined): User | null {
  if (!dto) return null;
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    email: dto.email,
    mode: dto.mode,
    isDriver: dto.isDriver,
    createdAt: dto.createdAt,
    emergencyContactName: dto.emergencyContactName,
    emergencyContactPhone: dto.emergencyContactPhone,
  };
}

export function domainToDtoAuthUser(user: User): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    mode: user.mode,
    isDriver: user.isDriver,
    createdAt: user.createdAt,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
  };
}

export function domainToRequestOtpDto(input: AuthOtpRequestInput, dryRun: boolean): RequestOtpRequestDto {
  return {
    phoneNumber: input.phoneNumber,
    channel: input.channel,
    dryRun,
  };
}

export function dtoToDomainOtpRequest(dto: RequestOtpResponseDto): AuthOtpRequestResult {
  return {
    requestId: dto.requestId,
    maskedPhoneNumber: dto.maskedPhoneNumber,
    expiresAt: dto.expiresAt,
  };
}

export function domainToVerifyOtpDto(input: AuthVerifyOtpInput, metadata: ApiIdempotencyMetadata): VerifyOtpRequestDto {
  return {
    phoneNumber: input.phoneNumber,
    otp: input.otp,
    ...metadata,
  };
}

export function dtoToDomainAuthSession(dto: VerifyOtpResponseDto | RefreshSessionResponseDto): AuthSessionDomain {
  return {
    user: dtoToDomainAuthUser(dto.user),
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    expiresAt: dto.expiresAt,
  };
}

export function domainToRefreshSessionDto(refreshToken: string): RefreshSessionRequestDto {
  return { refreshToken };
}

export function domainToLogoutDto(refreshToken: string, metadata: ApiIdempotencyMetadata): LogoutRequestDto {
  return {
    refreshToken,
    ...metadata,
  };
}

export function dtoToDomainCurrentSession(dto: CurrentSessionResponseDto): AuthCurrentSessionDomain {
  return {
    user: dtoToDomainAuthUser(dto.user),
    expiresAt: dto.expiresAt,
  };
}

export function dtoToDomainAuth<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoAuth<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureAuth(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'auth', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('auth', 'errorToRepositoryFailure', 'mapper');
}
