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
    if (__DEV__) {
      const status = err.response?.status ?? 'NO_RESPONSE';
      const url = err.config?.url ?? '';
      const method = err.config?.method?.toUpperCase() ?? '';
      // Suppress known "expected empty" responses that are not real errors:
      //  • 401 on /auth/logout        — session already revoked server-side
      //  • 404 on /driver/rides/active — idle driver has no active ride
      //  • 403 on /driver/availability — customer accounts don't have a driver profile
      //  • NO_RESPONSE on /auth/logout or /driver/availability — best-effort calls
      //    during logout fire with a 3 s timeout; timeout ≠ actual problem
      const isExpectedEmpty =
        (url.includes('/auth/logout') && status === 401) ||
        (url.includes('/driver/rides/active') && status === 404) ||
        (url.includes('/driver/availability') && status === 403) ||
        (url.includes('/auth/logout') && status === 'NO_RESPONSE') ||
        (url.includes('/driver/availability') && status === 'NO_RESPONSE');
      if (!isExpectedEmpty) {
        const body = err.response?.data ?? err.message;
        console.error(
          `[API ✗] ${status} ${method} ${url}`,
          '\n  error:', JSON.stringify(body, null, 2),
        );
      }
    }

    // Never attempt auto-refresh on these endpoints:
    //  • /auth/logout        — 401 means already logged out, that's fine
    //  • /driver/rides/active — 404 means idle, handled by the service layer
    //  • /driver/availability — called as best-effort before logout; any error is intentional
    const url = err.config?.url ?? '';
    if (
      url.includes('/auth/logout') ||
      url.includes('/driver/rides/active') ||
      url.includes('/driver/availability')
    ) throw err;

    if (err.response?.status !== 401 || isRefreshing) throw err;

    isRefreshing = true;
    try {
      const refresh = await SecureStore.getItemAsync('refresh_token');
      if (!refresh) throw new Error('no refresh token');
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
    } catch (refreshErr) {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      router.replace('/(auth)/welcome');
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }

    throw err;
  },
);
