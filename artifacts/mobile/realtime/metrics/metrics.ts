import type { HeartbeatSnapshot } from '../heartbeat/heartbeat';
import type { RealtimePresenceState } from '../presence/presence';
import type { SubscriptionRegistrySnapshot } from '../subscriptions/subscriptionRegistry';

export interface RealtimeMetricsSnapshot {
  connection: RealtimePresenceState;
  latencyMs: number | null;
  subscriptionCount: number;
  heartbeat: HeartbeatSnapshot;
  reconnectCount: number;
}

export function createRealtimeMetricsSnapshot(input: {
  connection: RealtimePresenceState;
  heartbeat: HeartbeatSnapshot;
  subscriptions: SubscriptionRegistrySnapshot;
  reconnectCount: number;
}): RealtimeMetricsSnapshot {
  return {
    connection: input.connection,
    latencyMs: input.heartbeat.latencyMs,
    subscriptionCount: input.subscriptions.size,
    heartbeat: input.heartbeat,
    reconnectCount: input.reconnectCount,
  };
}
