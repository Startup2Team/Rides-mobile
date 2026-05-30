import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const __DEV__ = process.env.NODE_ENV !== 'production';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ─── Request interceptor: attach JWT + dev logging ──────────────────────────
api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('access_token');
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

// ─── Response interceptor: dev logging + 401 auto-refresh ───────────────────
let isRefreshing = false;

api.interceptors.response.use(
  response => {
    // Unwrap the backend's { "data": { ... } } envelope so every caller
    // receives the inner payload directly via response.data.
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
    //  • /auth/logout        — any error here is intentional (already logged out)
    //  • /driver/rides/active — 404 = idle driver, handled by the service layer
    //  • /driver/availability — best-effort before logout; errors are expected
    const skipRefresh =
      url.includes('/auth/logout') ||
      url.includes('/driver/rides/active') ||
      url.includes('/driver/availability');

    // ── Post-logout 401 detection ─────────────────────────────────────────
    // After logout the tokens are deleted, but in-flight or queued effects
    // (rides list, saved locations, fare estimate) still fire before navigation
    // completes. They all get 401 responses. Rather than logging noise or
    // creating "no refresh token" unhandled rejections, detect this situation
    // early: a 401 on a non-exempt endpoint with no stored refresh token means
    // we are already logged out.
    const isPostLogout401 =
      status === 401 &&
      !skipRefresh &&
      !isRefreshing &&
      !(await SecureStore.getItemAsync('refresh_token'));

    if (__DEV__) {
      // Suppress known "expected empty" responses that are not real errors:
      //  • 401 on /auth/logout          — session already revoked server-side
      //  • 404 on /driver/rides/active  — idle driver has no active ride
      //  • 403 on /driver/availability  — customer accounts lack a driver profile
      //  • NO_RESPONSE on logout/avail  — best-effort calls with short timeout
      //  • post-logout 401 on any route — tokens already gone, redirect is pending
      const isExpectedEmpty =
        (url.includes('/auth/logout') && status === 401) ||
        (url.includes('/driver/rides/active') && status === 404) ||
        (url.includes('/driver/availability') && status === 403) ||
        (url.includes('/auth/logout') && status === 'NO_RESPONSE') ||
        (url.includes('/driver/availability') && status === 'NO_RESPONSE') ||
        isPostLogout401;
      if (!isExpectedEmpty) {
        const body = err.response?.data ?? err.message;
        console.error(
          `[API ✗] ${status} ${method} ${url}`,
          '\n  error:', JSON.stringify(body, null, 2),
        );
      }
    }

    // Exempt endpoints: reject immediately, never refresh.
    if (skipRefresh) return Promise.reject(err);

    // Post-logout 401: silently redirect and reject with the original 401.
    // No new errors thrown — the caller receives a clean 401 AxiosError.
    if (isPostLogout401) {
      router.replace('/(auth)/welcome');
      return Promise.reject(err);
    }

    // Non-401 or a concurrent request while a refresh is already in flight:
    // reject silently — the primary refresh attempt will handle navigation.
    if (status !== 401 || isRefreshing) return Promise.reject(err);

    // ── Token refresh ─────────────────────────────────────────────────────
    // We only reach here when: status === 401, !isRefreshing, refresh token
    // exists (checked above via isPostLogout401 gate).
    isRefreshing = true;
    try {
      const refresh = await SecureStore.getItemAsync('refresh_token');
      // refresh is guaranteed non-null (isPostLogout401 would have caught the
      // empty-token case above), but guard defensively.
      if (!refresh) {
        router.replace('/(auth)/welcome');
        return Promise.reject(err);
      }
      const { data: raw } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
      // Backend wraps responses in { "data": { ... } }. Raw axios doesn't
      // run our interceptor, so we have to unwrap the envelope manually.
      const data = (raw && typeof raw === 'object' && 'data' in raw) ? raw.data : raw;
      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      if (err.config) {
        err.config.headers = err.config.headers ?? {};
        err.config.headers.Authorization = `Bearer ${data.access_token}`;
        return api.request(err.config);
      }
    } catch {
      // Refresh failed (token expired, revoked, network error).
      // Clean up and redirect — return the original 401 AxiosError, not a new
      // "refresh failed" error, so callers get a consistent error shape.
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      router.replace('/(auth)/welcome');
    } finally {
      isRefreshing = false;
    }

    return Promise.reject(err);
  },
);
