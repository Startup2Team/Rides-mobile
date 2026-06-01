import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const __DEV__ = process.env.NODE_ENV !== 'production';

/** Proactively refresh the access token this many seconds before it expires. */
const PROACTIVE_REFRESH_S = 90;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ── JWT expiry helpers ────────────────────────────────────────────────────────

/** Decode the exp claim from a JWT without a library (base64 payload). */
function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Returns true if the token expires within `seconds` from now. */
function expiresWithin(token: string, seconds: number): boolean {
  const exp = tokenExpiresAt(token);
  if (exp === null) return false;
  return exp - Math.floor(Date.now() / 1000) < seconds;
}

// ── Serialised refresh: all concurrent callers share one in-flight attempt ───
//
// Without this, multiple requests that all get 401 simultaneously each try to
// refresh on their own, causing race conditions and redundant /auth/refresh calls.
// With this, the first caller does the refresh; all others queue and receive the
// new token when it resolves (or the error if it fails).

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

async function doRefresh(): Promise<string> {
  const refresh = await SecureStore.getItemAsync('refresh_token');
  if (!refresh) throw new Error('no_refresh_token');
  // Bypass our intercepted `api` instance to avoid infinite retry loops.
  const { data: raw } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
  const data = (raw && typeof raw === 'object' && 'data' in raw) ? raw.data : raw;
  await SecureStore.setItemAsync('access_token', data.access_token);
  await SecureStore.setItemAsync('refresh_token', data.refresh_token);
  return data.access_token as string;
}

/**
 * Refresh the access token exactly once, even if called concurrently.
 * All concurrent callers queue on the same in-flight promise.
 */
async function refreshOnce(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const newToken = await doRefresh();
    refreshQueue.forEach(q => q.resolve(newToken));
    return newToken;
  } catch (err) {
    refreshQueue.forEach(q => q.reject(err));
    throw err;
  } finally {
    refreshQueue = [];
    isRefreshing = false;
  }
}

// ─── Request interceptor: attach JWT + proactive refresh + dev logging ────────
//
// Proactive refresh: if the token expires within PROACTIVE_REFRESH_S seconds we
// refresh before sending so the request goes out with a fresh token and the user
// never sees a 401 mid-flow. This covers app-resume after 14+ minutes in the
// background — the single most common "token expired" scenario.

api.interceptors.request.use(async config => {
  let token = await SecureStore.getItemAsync('access_token');

  if (token && expiresWithin(token, PROACTIVE_REFRESH_S)) {
    try {
      token = await refreshOnce();
    } catch {
      // Refresh failed here (no network, revoked token). Let the request
      // proceed with the stale token; the 401 response interceptor will
      // attempt the refresh again and handle navigation if it still fails.
    }
  }

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) {
    console.log(
      `[API →] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
      config.data ? '\n  body:' : '',
      config.data ?? '',
    );
  }

  return config;
});

// ─── Response interceptor: unwrap envelope + 401 reactive refresh ─────────────
//
// Reactive refresh: if the proactive path missed (e.g. token expired between
// the request interceptor and the actual response), catch 401 here, refresh
// once, and replay the original request transparently.

api.interceptors.response.use(
  response => {
    // Unwrap the backend's { "data": { ... } } envelope.
    if (
      response.data !== null &&
      typeof response.data === 'object' &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    if (__DEV__) {
      console.log(
        `[API ←] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
        '\n  data:', response.data,
      );
    }
    return response;
  },
  async (err: AxiosError) => {
    const status = err.response?.status ?? 'NO_RESPONSE';
    const url    = err.config?.url ?? '';
    const method = err.config?.method?.toUpperCase() ?? '';

    // ── Endpoints that must never trigger auto-refresh ────────────────────
    const skipRefresh =
      url.includes('/auth/logout') ||
      url.includes('/driver/rides/active') ||
      url.includes('/driver/availability');

    // ── Post-logout stale-request detection ──────────────────────────────
    // After logout the tokens are deleted but in-flight effects still fire
    // and receive 401s. Detect this early to avoid a spurious "no refresh
    // token" error flood.
    const isPostLogout401 =
      status === 401 &&
      !skipRefresh &&
      !(await SecureStore.getItemAsync('refresh_token'));

    if (__DEV__) {
      const isExpectedEmpty =
        (url.includes('/auth/logout') && status === 401) ||
        (url.includes('/driver/rides/active') && status === 404) ||
        // customer/rides/active returns 404 when the customer has no active ride
        (url.includes('/customer/rides/active') && status === 404) ||
        (url.includes('/driver/availability') && status === 403) ||
        (url.includes('/auth/logout') && status === 'NO_RESPONSE') ||
        (url.includes('/driver/availability') && status === 'NO_RESPONSE') ||
        // Simulator/testing GPS can teleport between locations, triggering the
        // backend's speed-plausibility guard. Not a real error in dev.
        (url.includes('/driver/location') && status === 422) ||
        isPostLogout401;
      if (!isExpectedEmpty) {
        const body = err.response?.data ?? err.message;
        console.error(
          `[API ✗] ${status} ${method} ${url}`,
          '\n  error:', JSON.stringify(body, null, 2),
        );
      }
    }

    if (skipRefresh) return Promise.reject(err);

    if (isPostLogout401) {
      router.replace('/(auth)/welcome');
      return Promise.reject(err);
    }

    if (status !== 401) return Promise.reject(err);

    // ── 401 with a refresh token: refresh once and replay ─────────────────
    try {
      const newToken = await refreshOnce();
      if (err.config) {
        err.config.headers = err.config.headers ?? {};
        err.config.headers.Authorization = `Bearer ${newToken}`;
        return api.request(err.config);
      }
    } catch {
      // Refresh token itself is expired or revoked. Clear everything and
      // send the user back to the welcome screen. They'll re-authenticate
      // with OTP — for a 30-day refresh token this should be very rare.
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      router.replace('/(auth)/welcome');
    }

    return Promise.reject(err);
  },
);
