import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from './api';

async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync('device_id');
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync('device_id', id);
  }
  return id;
}

export function toE164(countryDialCode: string, digits: string): string {
  const cleanCode = countryDialCode.replace(/\D/g, '');
  const cleanDigits = digits.replace(/\D/g, '').replace(/^0+/, '');
  return `+${cleanCode}${cleanDigits}`;
}

export async function register(phoneNumber: string, fullName?: string): Promise<{ devOtp?: string }> {
  const deviceId = await getOrCreateDeviceId();
  const res = await api.post('/auth/register', {
    phone_number: phoneNumber,
    full_name: fullName ?? '',
    device_id: deviceId,
    platform: Platform.OS,
  });
  // In dev mode the backend echoes the OTP back so the screen can auto-fill it.
  // The response interceptor has already unwrapped { data: { dev_otp } } → { dev_otp }.
  return { devOtp: res.data?.dev_otp };
}

export async function verifyOtp(phoneNumber: string, otp: string) {
  const deviceId = await getOrCreateDeviceId();
  // Interceptor unwraps { data: { access_token, refresh_token, role_state, user_id } }
  // so response.data IS the inner payload directly.
  const { data } = await api.post<{
    access_token: string;
    refresh_token: string;
    role_state: string;
    user_id: string;
  }>('/auth/verify-otp', {
    phone_number: phoneNumber,
    otp,
    device_id: deviceId,
  });
  await SecureStore.setItemAsync('access_token', data.access_token);
  await SecureStore.setItemAsync('refresh_token', data.refresh_token);
  return data;
}

// Short timeout for best-effort pre-logout calls. These are fire-and-forget —
// the local token deletion below is what actually logs the user out. We never
// want a slow/dead backend to block the UX for more than a few seconds.
const LOGOUT_TIMEOUT_MS = 3000;

export async function logout() {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    // Best-effort: mark driver offline before revoking the token so the backend
    // removes the driver from the Redis GEO pool immediately rather than waiting
    // for the inactivity cooldown. Non-driver accounts receive a 403 — that's fine.
    try {
      await api.patch('/driver/availability', { is_online: false }, { timeout: LOGOUT_TIMEOUT_MS });
    } catch {}

    // Best-effort server-side session revocation. A 401 means the session
    // was already invalidated (e.g. double-tap or expired token) — ignore it.
    try {
      await api.post('/auth/logout', undefined, { timeout: LOGOUT_TIMEOUT_MS });
    } catch {
      // no-op — local token deletion below is what actually logs the user out
    }
  }
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}
