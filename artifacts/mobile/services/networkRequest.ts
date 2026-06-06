export type NetworkErrorKind =
  | 'aborted'
  | 'timeout'
  | 'http'
  | 'network'
  | 'invalid-response'
  | 'configuration';

interface NetworkRequestErrorOptions {
  kind: NetworkErrorKind;
  service: string;
  operation: string;
  status?: number;
  retryable?: boolean;
  attempt?: number;
}

export class NetworkRequestError extends Error {
  readonly kind: NetworkErrorKind;
  readonly service: string;
  readonly operation: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly attempt: number;

  constructor(options: NetworkRequestErrorOptions) {
    super(`${options.service} ${options.operation} request failed`);
    this.name = 'NetworkRequestError';
    this.kind = options.kind;
    this.service = options.service;
    this.operation = options.operation;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.attempt = options.attempt ?? 1;
  }
}

interface ResilientFetchOptions {
  service: string;
  operation: string;
  timeoutMs: number;
  retries?: number;
  retryDelayMs?: number;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429]);

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'));
      return;
    }

    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('Request aborted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function asNetworkError(
  error: unknown,
  options: ResilientFetchOptions,
  attempt: number,
  timedOut: boolean,
  externalSignal?: AbortSignal,
) {
  if (error instanceof NetworkRequestError) return error;

  return new NetworkRequestError({
    kind: externalSignal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'network',
    service: options.service,
    operation: options.operation,
    retryable: !externalSignal?.aborted,
    attempt,
  });
}

export async function fetchWithResilience(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions,
): Promise<Response> {
  const retries = (init.method ?? 'GET').toUpperCase() === 'GET' ? options.retries ?? 0 : 0;
  const retryDelayMs = options.retryDelayMs ?? 250;
  const externalSignal = init.signal ?? undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    if (externalSignal?.aborted) {
      throw new NetworkRequestError({
        kind: 'aborted',
        service: options.service,
        operation: options.operation,
        attempt,
      });
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new NetworkRequestError({
          kind: 'http',
          service: options.service,
          operation: options.operation,
          status: response.status,
          retryable: isRetryableStatus(response.status),
          attempt,
        });
      }
      return response;
    } catch (error) {
      const networkError = asNetworkError(error, options, attempt, timedOut, externalSignal);
      if (attempt > retries || !networkError.retryable) throw networkError;
      try {
        await waitForRetry(retryDelayMs, externalSignal);
      } catch {
        throw new NetworkRequestError({
          kind: 'aborted',
          service: options.service,
          operation: options.operation,
          attempt,
        });
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  throw new NetworkRequestError({
    kind: 'network',
    service: options.service,
    operation: options.operation,
  });
}

export function isAbortedNetworkRequest(error: unknown) {
  return error instanceof NetworkRequestError && error.kind === 'aborted';
}

export async function parseJsonResponse<T>(
  response: Response,
  service: string,
  operation: string,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new NetworkRequestError({
      kind: 'invalid-response',
      service,
      operation,
    });
  }
}
