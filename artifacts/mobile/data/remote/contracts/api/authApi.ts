import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';

export interface RequestOtpRequestDto {
  phoneNumber: string;
  channel?: 'sms' | 'whatsapp' | 'voice';
  dryRun?: boolean;
}

export interface RequestOtpResponseDto {
  requestId: string;
  maskedPhoneNumber: string;
  expiresAt: string;
}

export interface VerifyOtpRequestDto extends ApiIdempotencyMetadata {
  phoneNumber: string;
  otp: string;
}

export interface VerifyOtpResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user?: AuthUserDto | null;
}

export interface RefreshSessionRequestDto {
  refreshToken: string;
}

export interface RefreshSessionResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user?: AuthUserDto | null;
}

export interface LogoutRequestDto extends ApiIdempotencyMetadata {
  refreshToken: string;
}

export interface LogoutResponseDto {
  success: true;
}

export interface AuthUserDto {
  id: string;
  name: string;
  phone: string;
  email?: string;
  mode: 'customer' | 'driver';
  isDriver: boolean;
  createdAt: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface CurrentSessionResponseDto {
  user: AuthUserDto | null;
  expiresAt: string | null;
}

export interface AuthErrorDto extends ApiErrorDto {}

export interface AuthApiContract {
  requestOtp: RequestOtpRequestDto;
  verifyOtp: VerifyOtpRequestDto;
  refreshSession: RefreshSessionRequestDto;
  logout: LogoutRequestDto;
  responses: {
    requestOtp: ApiEnvelope<RequestOtpResponseDto>;
    verifyOtp: ApiEnvelope<VerifyOtpResponseDto>;
    refreshSession: ApiEnvelope<RefreshSessionResponseDto>;
    logout: ApiEnvelope<LogoutResponseDto>;
    currentSession: ApiEnvelope<CurrentSessionResponseDto>;
  };
}

export const RequestOtpRequestDto = {} as RequestOtpRequestDto;
export const RequestOtpResponseDto = {} as RequestOtpResponseDto;
export const VerifyOtpRequestDto = {} as VerifyOtpRequestDto;
export const VerifyOtpResponseDto = {} as VerifyOtpResponseDto;
export const RefreshSessionRequestDto = {} as RefreshSessionRequestDto;
export const RefreshSessionResponseDto = {} as RefreshSessionResponseDto;
export const LogoutRequestDto = {} as LogoutRequestDto;
export const LogoutResponseDto = {} as LogoutResponseDto;
export const AuthUserDto = {} as AuthUserDto;
export const CurrentSessionResponseDto = {} as CurrentSessionResponseDto;
