import { getAccessToken } from '@/persistence/authTokens';

import { resolveBackendTransportConfig } from '../transport/backendTransportConfig';
import { createHttpBackendTransport } from '../transport/httpBackendTransport';
import { BackendClient } from './backendClient';

// A single shared client for the whole app: it points at the real backend
// (EXPO_PUBLIC_BACKEND_* env) and attaches the stored access token to every
// request via the transport's tokenProvider.
let cached: BackendClient | null = null;

export function getAppBackendClient(): BackendClient {
  if (cached) return cached;

  const config = resolveBackendTransportConfig();
  const baseUrl = config.baseUrl ?? process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? '';

  const transport = createHttpBackendTransport({
    baseUrl,
    timeoutMs: config.timeoutMs,
    tokenProvider: () => getAccessToken(),
  });

  cached = new BackendClient({ baseUrl, transport });
  return cached;
}
