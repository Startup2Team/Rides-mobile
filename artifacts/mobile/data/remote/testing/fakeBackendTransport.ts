import type { BackendResponse, BackendTransport } from '../contracts/backendClientTypes';

export interface FakeBackendRoute<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  response?: BackendResponse<T>;
  error?: unknown;
  delayMs?: number;
}

export function createFakeBackendTransport(routes: FakeBackendRoute[]) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];

  const transport: BackendTransport = async ({ method, path, options }) => {
    calls.push({ method, path, body: options?.body });
    const route = routes.find(item => item.method === method && item.path === path);
    if (!route) {
      throw new Error(`Missing fake backend route for ${method} ${path}`);
    }
    if (route.delayMs) {
      await new Promise(resolve => setTimeout(resolve, route.delayMs));
    }
    if (route.error) {
      throw route.error;
    }
    return route.response ?? { status: 200, data: undefined };
  };

  return {
    transport,
    calls,
  };
}
