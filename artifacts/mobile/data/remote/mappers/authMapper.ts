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
import type { DeviceMetadata } from '../client/deviceMetadata';

export interface AuthOtpRequestInput {
  phoneNumber: string;
  channel?: 'sms' | 'whatsapp' | 'voice';
  // Optional profile fields the register step can send (backend accepts them).
  fullName?: string;
  email?: string;
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

// role_state (e.g. CUSTOMER | DRIVER_ACTIVE | DRIVER_PENDING) → app user mode.
function isDriverRole(roleState: string | undefined): boolean {
  return (roleState ?? '').toUpperCase().startsWith('DRIVER');
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}

// Build a minimal User from the flat verify response. The backend returns only
// { user_id, role_state } here, so name/email are filled later by a profile fetch.
function minimalUser(userId: string, roleState: string, phoneNumber: string): User {
  const driver = isDriverRole(roleState);
  return {
    id: userId,
    name: '',
    phone: phoneNumber,
    email: undefined,
    mode: driver ? 'driver' : 'customer',
    isDriver: driver,
    createdAt: '',
    emergencyContactName: undefined,
    emergencyContactPhone: undefined,
  };
}

export function domainToRequestOtpDto(input: AuthOtpRequestInput, device: DeviceMetadata): RequestOtpRequestDto {
  return {
    phone_number: input.phoneNumber,
    full_name: input.fullName,
    email: input.email,
    device_id: device.device_id,
    platform: device.platform,
  };
}

// Register returns { dev_otp } (dev) or 204 empty (prod) — neither carries a
// request id / expiry, so synthesize a result the UI can display.
export function dtoToDomainOtpRequest(_dto: RequestOtpResponseDto | undefined, phoneNumber: string): AuthOtpRequestResult {
  return {
    requestId: '',
    maskedPhoneNumber: maskPhone(phoneNumber),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

export function domainToVerifyOtpDto(input: AuthVerifyOtpInput, device: DeviceMetadata): VerifyOtpRequestDto {
  return {
    phone_number: input.phoneNumber,
    otp: input.otp,
    device_id: device.device_id,
    platform: device.platform,
    app_version: device.app_version,
  };
}

// Verify carries a flat token payload + minimal user; refresh carries just tokens
// (user stays null so the caller keeps its existing hydrated user).
export function dtoToDomainAuthSession(
  dto: VerifyOtpResponseDto | RefreshSessionResponseDto,
  phoneNumber?: string,
): AuthSessionDomain {
  const userId = 'user_id' in dto ? dto.user_id : undefined;
  const user = userId && phoneNumber ? minimalUser(userId, dto.role_state ?? '', phoneNumber) : null;
  return {
    user,
    accessToken: dto.access_token,
    refreshToken: dto.refresh_token,
    // Backend doesn't return an expiry — the transport refreshes on 401.
    expiresAt: '',
  };
}

export function domainToRefreshSessionDto(refreshToken: string): RefreshSessionRequestDto {
  return { refresh_token: refreshToken };
}

export function domainToLogoutDto(refreshToken: string): LogoutRequestDto {
  return { refresh_token: refreshToken };
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
