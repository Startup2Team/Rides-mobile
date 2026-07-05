import { BackendError, RateLimitedError, ServerError, TimeoutError, BackendUnavailableError, OfflineError } from '../contracts/backendErrors';

export interface BackendRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_BACKEND_RETRY_POLICY: BackendRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 150,
  maxDelayMs: 1000,
  jitterRatio: 0.2,
};

export function canRetryBackendRequest(input: {
  method: string;
  error: unknown;
  retrySafe?: boolean;
  idempotencyKey?: string | null;
}) {
  const method = input.method.toUpperCase();
  const readSafe = method === 'GET';
  const writeSafe = Boolean(input.retrySafe && input.idempotencyKey);
  if (!readSafe && !writeSafe) return false;

  if (input.error instanceof TimeoutError) return true;
  if (input.error instanceof OfflineError) return true;
  if (input.error instanceof BackendUnavailableError) return true;
  if (input.error instanceof RateLimitedError) return true;
  if (input.error instanceof ServerError) {
    return !input.error.status || input.error.status >= 500;
  }
  if (input.error instanceof BackendError) {
    return input.error.retryable;
  }
  return false;
}

export function getRetryDelayMs(attempt: number, policy: BackendRetryPolicy, random = Math.random) {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * policy.jitterRatio * random();
  return Math.round(exponential + jitter);
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
