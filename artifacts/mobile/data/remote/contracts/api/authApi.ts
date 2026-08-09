import type { ApiEnvelope, ApiErrorDto } from './shared';

// Wire shapes match the real backend (POST /api/v1/auth/*). snake_case, since the
// bodies are sent as-is and the backend validates snake_case fields.

// POST /auth/register — sends the OTP.
export interface RequestOtpRequestDto {
  phone_number: string;
  full_name?: string;
  email?: string;
  device_id: string;
  platform: 'ios' | 'android';
}

// Register returns { dev_otp } in non-prod, or 204 (empty) in prod.
export interface RequestOtpResponseDto {
  dev_otp?: string;
}

// POST /auth/verify-otp
export interface VerifyOtpRequestDto {
  phone_number: string;
  otp: string;
  device_id: string;
  platform?: 'ios' | 'android';
  app_version?: string;
}

// Flat session payload — no nested user object, but it does state WHO signed in.
// full_name/phone_number/email were added because without them the app had to
// guess at a name until a follow-up /customer/profile call landed, and showed
// the previously stored account's name whenever that call failed.
// Optional: an older backend omits them, and the app must keep working against it.
export interface VerifyOtpResponseDto {
  access_token: string;
  refresh_token: string;
  role_state: string;
  user_id: string;
  phone_number?: string;
  full_name?: string;
  email?: string;
}

// POST /auth/refresh
export interface RefreshSessionRequestDto {
  refresh_token: string;
}

export interface RefreshSessionResponseDto {
  access_token: string;
  refresh_token: string;
  role_state?: string;
  user_id?: string;
}

// POST /auth/logout — { refresh_token } → 204 (empty).
export interface LogoutRequestDto {
  refresh_token: string;
}

export interface LogoutResponseDto {
  success?: boolean;
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
