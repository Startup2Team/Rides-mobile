import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import {
  RemoteAuthRepository,
  type AuthSessionRepository,
} from '@/data/remote/repositories/RemoteAuthRepository';
import type {
  AuthOtpRequestInput,
  AuthOtpRequestResult,
  AuthSessionDomain,
  AuthVerifyOtpInput,
} from '@/data/remote/mappers/authMapper';
import {
  clearAuthTokens,
  getRefreshToken,
  saveAuthTokens,
} from '@/persistence/authTokens';

// Real-backend auth for the customer/driver app. Screens call these thin
// wrappers; token persistence stays here so the UI never touches the enclave.
let repository: AuthSessionRepository | null = null;

function getRepository(): AuthSessionRepository {
  if (!repository) {
    repository = new RemoteAuthRepository({ client: getAppBackendClient() });
  }
  return repository;
}

// POST /api/v1/auth/register — sends the OTP to the phone number.
export function requestOtp(input: AuthOtpRequestInput): Promise<AuthOtpRequestResult> {
  return getRepository().requestOtp(input);
}

// POST /api/v1/auth/verify-otp — exchanges the OTP for a session, then persists
// the access + refresh tokens so every later request is authenticated.
export async function verifyOtp(input: AuthVerifyOtpInput): Promise<AuthSessionDomain> {
  const session = await getRepository().verifyOtp(input);
  if (session.accessToken && session.refreshToken) {
    await saveAuthTokens(session.accessToken, session.refreshToken);
  }
  return session;
}

// POST /api/v1/auth/login — phone-only login (no OTP): the number was verified
// at registration, so signing in on any device needs only the number. Persists
// the returned tokens exactly like verifyOtp. Throws if the number has no
// account (the login screen surfaces that as "register instead").
export async function loginWithPhone(phoneNumber: string): Promise<AuthSessionDomain> {
  const session = await getRepository().login(phoneNumber);
  if (session.accessToken && session.refreshToken) {
    await saveAuthTokens(session.accessToken, session.refreshToken);
  }
  return session;
}

// DELETE /api/v1/auth/account — permanently anonymizes the account server-side
// and revokes every session. Must run while still authenticated (it uses the
// access token). Throws on failure so the caller can surface it instead of
// pretending the account was deleted. Local cleanup (tokens/sensitive storage)
// is the caller's job (via logout) once this resolves.
export async function deleteAccount(): Promise<void> {
  await getAppBackendClient().delete('/v1/auth/account');
}

// Best-effort backend logout, then always drop the local tokens.
export async function endSession(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    await getRepository().logout(refreshToken);
  } catch {
    // Ignore network/logout failures — the local session is cleared regardless.
  } finally {
    await clearAuthTokens();
  }
}
