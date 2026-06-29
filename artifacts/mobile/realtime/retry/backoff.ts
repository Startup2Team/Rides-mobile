export interface RealtimeReconnectPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_REALTIME_RECONNECT_POLICY: RealtimeReconnectPolicy = {
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitterRatio: 0,
};

export function getReconnectDelayMs(
  attempt: number,
  policy: RealtimeReconnectPolicy = DEFAULT_REALTIME_RECONNECT_POLICY,
) {
  const exponent = Math.max(0, attempt - 1);
  const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent);
  if (!policy.jitterRatio) return delay;
  const jitter = delay * policy.jitterRatio * Math.random();
  return Math.round(delay + jitter);
}
