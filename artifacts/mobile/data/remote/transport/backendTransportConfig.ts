import type { BackendTransportEnvironment, ResolvedBackendTransportConfig } from './httpBackendTransportTypes';

export const DEFAULT_BACKEND_REQUEST_TIMEOUT_MS = 12000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function getEnvValue(env: BackendTransportEnvironment, key: keyof BackendTransportEnvironment) {
  return env[key]?.trim();
}

export function readBackendTransportEnvironment(): BackendTransportEnvironment {
  return {
    backendEnv: process.env.EXPO_PUBLIC_BACKEND_ENV,
    backendBaseUrl: process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
    savedLocationsRepositoryMode: process.env.EXPO_PUBLIC_SAVED_LOCATIONS_REPOSITORY_MODE,
    savedLocationsShadowWritesEnabled: process.env.EXPO_PUBLIC_SAVED_LOCATIONS_SHADOW_WRITES_ENABLED,
    profileRepositoryMode: process.env.EXPO_PUBLIC_PROFILE_REPOSITORY_MODE,
    profileShadowWritesEnabled: process.env.EXPO_PUBLIC_PROFILE_SHADOW_WRITES_ENABLED,
  };
}

export function isLocalhostUrl(url: URL) {
  return (
    LOCAL_HOSTS.has(url.hostname) ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.')
  );
}

export function validateBackendBaseUrl(rawUrl: string, environment: 'STAGING' | 'PRODUCTION'): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'malformed-url' };
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhostUrl(parsed))) {
    return { ok: false, reason: 'non-https-remote-url' };
  }

  if (environment === 'PRODUCTION' && isLocalhostUrl(parsed)) {
    return { ok: false, reason: 'production-localhost-url' };
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return { ok: true, url: parsed.toString().replace(/\/$/, '') };
}

export function resolveBackendTransportConfig(
  env: BackendTransportEnvironment = readBackendTransportEnvironment(),
): ResolvedBackendTransportConfig {
  const rawEnvironment = getEnvValue(env, 'backendEnv')?.toUpperCase() || 'LOCAL';

  if (rawEnvironment === 'DISABLED') {
    return {
      environment: rawEnvironment,
      enabled: false,
      baseUrl: null,
      timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
      reason: 'backend-disabled',
    };
  }

  const rawUrl = getEnvValue(env, 'backendBaseUrl') ?? process.env.EXPO_PUBLIC_API_BASE_URL;

  if (rawEnvironment === 'LOCAL') {
    if (rawUrl) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(rawUrl);
      } catch {
        // Fallback for relative or malformed URLs
      }
      if (parsed) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, '');
        return {
          environment: 'LOCAL',
          enabled: true,
          baseUrl: parsed.toString().replace(/\/$/, ''),
          timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
        };
      }
    }
    return {
      environment: 'LOCAL',
      enabled: false,
      baseUrl: null,
      timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
      reason: 'backend-disabled',
    };
  }

  if (rawEnvironment !== 'STAGING' && rawEnvironment !== 'PRODUCTION') {
    return {
      environment: 'DISABLED',
      enabled: false,
      baseUrl: null,
      timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
      reason: 'invalid-backend-environment',
    };
  }

  if (!rawUrl) {
    return {
      environment: rawEnvironment,
      enabled: false,
      baseUrl: null,
      timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
      reason: 'missing-base-url',
    };
  }

  const validated = validateBackendBaseUrl(rawUrl, rawEnvironment);
  if (!validated.ok) {
    return {
      environment: rawEnvironment,
      enabled: false,
      baseUrl: null,
      timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
      reason: validated.reason,
    };
  }

  return {
    environment: rawEnvironment,
    enabled: true,
    baseUrl: validated.url,
    timeoutMs: DEFAULT_BACKEND_REQUEST_TIMEOUT_MS,
  };
}
