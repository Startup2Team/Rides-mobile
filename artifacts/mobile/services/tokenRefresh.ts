import { getRefreshToken, saveAuthTokens, clearAuthTokens } from '@/persistence/authTokens';
import { resolveBackendTransportConfig } from '@/data/remote/transport/backendTransportConfig';

// Standalone token refresh (raw fetch — must NOT go through the app client, or a
// 401 during refresh would recurse). POST /api/v1/auth/refresh { refresh_token }
// → { access_token, refresh_token }. Concurrent callers share one in-flight call.
let inFlight: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  const config = resolveBackendTransportConfig();
  const baseUrl = (config.baseUrl ?? process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? '').replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      // Refresh token itself is invalid/expired — clear so the app forces login.
      if (response.status === 401 || response.status === 403) await clearAuthTokens();
      return false;
    }
    const json = (await response.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
    const data = (json.data ?? json) as Record<string, unknown>;
    const access = data.access_token;
    const refresh = data.refresh_token;
    if (typeof access === 'string' && access.length > 0) {
      await saveAuthTokens(access, typeof refresh === 'string' && refresh ? refresh : refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
