import { z } from 'zod';

import { loadSecureStorage, removeSecureStorage, saveSecureStorage } from './secureStorage';

// Session tokens live in the OS secure enclave (Keychain / Keystore), never in
// plain AsyncStorage. The transport reads the access token on every request.
const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

const tokenSchema = z.string().min(1);

export async function saveAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    saveSecureStorage(ACCESS_TOKEN_KEY, accessToken),
    saveSecureStorage(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await loadSecureStorage(ACCESS_TOKEN_KEY, tokenSchema);
  return data ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const { data } = await loadSecureStorage(REFRESH_TOKEN_KEY, tokenSchema);
  return data ?? null;
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    removeSecureStorage(ACCESS_TOKEN_KEY),
    removeSecureStorage(REFRESH_TOKEN_KEY),
  ]);
}
