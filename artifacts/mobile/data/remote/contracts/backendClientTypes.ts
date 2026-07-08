export interface BackendRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  retrySafe?: boolean;
}

export interface BackendResponse<T = unknown> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}

export interface BackendDownload {
  status: number;
  data: ArrayBuffer | Blob | Uint8Array;
  headers?: Record<string, string>;
}

export interface BackendUpload {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

export type BackendTransport = (request: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  options?: BackendRequestOptions;
}) => Promise<BackendResponse>;

export interface BackendClientConfig {
  baseUrl?: string;
  transport?: BackendTransport;
}
