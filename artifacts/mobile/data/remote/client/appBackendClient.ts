import { getAccessToken } from '@/persistence/authTokens';
import { refreshAccessToken } from '@/services/tokenRefresh';

import { resolveBackendTransportConfig } from '../transport/backendTransportConfig';
import { createHttpBackendTransport } from '../transport/httpBackendTransport';
import { UnauthorizedError } from '../contracts/backendErrors';
import type { BackendTransport } from '../contracts/backendClientTypes';
import { BackendClient } from './backendClient';

// A single shared client for the whole app: it points at the real backend
// (EXPO_PUBLIC_BACKEND_* env) and attaches the stored access token to every
// request via the transport's tokenProvider.
let cached: BackendClient | null = null;

export function getAppBackendClient(): BackendClient {
  if (cached) return cached;

  const config = resolveBackendTransportConfig();
  const baseUrl = config.baseUrl ?? process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? '';

  const rawTransport = createHttpBackendTransport({
    baseUrl,
    timeoutMs: config.timeoutMs,
    tokenProvider: () => getAccessToken(),
  });

  // On a 401, try a one-time token refresh and replay the request. Auth calls
  // themselves are excluded to avoid recursion.
  const transport: BackendTransport = async request => {
    try {
      return await rawTransport(request);
    } catch (error) {
      const path = request.path ?? '';
      if (error instanceof UnauthorizedError && !path.includes('/auth/')) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return rawTransport(request);
      }
      throw error;
    }
  };

  cached = new BackendClient({ baseUrl, transport });
  return cached;
}
