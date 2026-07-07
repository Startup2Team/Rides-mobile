export type BackendClientRequestHeaders = Record<string, string>;

export interface BackendClientRequestOptions {
  headers?: BackendClientRequestHeaders;
  signal?: AbortSignal;
}

export interface BackendClient {
  get<T>(path: string, options?: BackendClientRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: BackendClientRequestOptions): Promise<T>;
}

export type BackendClientErrorKind =
  | 'aborted'
  | 'configuration'
  | 'http'
  | 'invalid-response'
  | 'network';

export interface BackendClientErrorOptions {
  kind: BackendClientErrorKind;
  service: string;
  operation: string;
  message?: string;
  status?: number;
  code?: string;
  details?: Record<string, unknown> | null;
}

export class BackendClientError extends Error {
  readonly kind: BackendClientErrorKind;
  readonly service: string;
  readonly operation: string;
  readonly status?: number;
  readonly code?: string;
  readonly details?: Record<string, unknown> | null;

  constructor(options: BackendClientErrorOptions) {
    super(options.message ?? `${options.service} ${options.operation} failed`);
    this.name = 'BackendClientError';
    this.kind = options.kind;
    this.service = options.service;
    this.operation = options.operation;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? null;
  }
}

export function isBackendClientError(error: unknown): error is BackendClientError {
  return error instanceof BackendClientError;
}
