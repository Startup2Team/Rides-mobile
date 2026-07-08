import type { PendingMutation, RetryPolicy } from '../types';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 1_000,
  maxDelayMs: 5 * 60 * 1_000,
  maxRetryCount: 5,
  jitterRatio: 0,
};

export function getRetryDelayMs(retryCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
  const exponent = Math.max(0, retryCount - 1);
  const rawDelay = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** exponent));
  if (policy.jitterRatio <= 0) return rawDelay;

  const jitter = rawDelay * policy.jitterRatio;
  return Math.max(0, Math.round(rawDelay - jitter + Math.random() * jitter * 2));
}

export function getNextRetryAt(now: Date, retryCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
  return new Date(now.getTime() + getRetryDelayMs(retryCount, policy)).toISOString();
}

export function canRetry(mutation: PendingMutation, policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
  return mutation.retryCount < policy.maxRetryCount;
}

export function isExpired(mutation: PendingMutation, now: Date) {
  return mutation.expiresAt ? new Date(mutation.expiresAt).getTime() <= now.getTime() : false;
}

export function isRetryDue(mutation: PendingMutation, now: Date) {
  return !mutation.nextRetryAt || new Date(mutation.nextRetryAt).getTime() <= now.getTime();
}
