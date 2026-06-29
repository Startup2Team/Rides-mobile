import { RealtimeConnectionManager } from '@/realtime/connection/connectionManager';
import type { RealtimeTransport } from '@/realtime/connection/transport';
import { RealtimeEventBus } from '@/realtime/events/eventBus';
import { RealtimeHeartbeat } from '@/realtime/heartbeat/heartbeat';
import { createRealtimeNetworkMonitor } from '@/realtime/network/networkMonitor';
import { SubscriptionRegistry } from '@/realtime/subscriptions/subscriptionRegistry';
import { createDeterministicClock, createReadinessStressProfile } from '../stress/readinessStress';
import { createReadinessGateResult } from '../types';
import type { ReadinessStressProfile } from '../types';

class RecordingTransport implements RealtimeTransport {
  connectCalls = 0;
  disconnectCalls = 0;
  sendCalls: Array<{ type: string; payload?: unknown }> = [];
  authenticateCalls: string[] = [];
  private listener: ((message: any) => void) | null = null;

  async connect() {
    this.connectCalls += 1;
  }

  async disconnect() {
    this.disconnectCalls += 1;
  }

  async send(message: { type: string; payload?: unknown }) {
    this.sendCalls.push(message);
  }

  async authenticate(token: string) {
    this.authenticateCalls.push(token);
  }

  subscribe(listener: (message: any) => void) {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
}

export async function runRealtimeGatewayReadinessScenario(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
) {
  const clock = createDeterministicClock();
  const eventBus = new RealtimeEventBus();
  const transport = new RecordingTransport();
  const network = createRealtimeNetworkMonitor({ isOnline: true, isInternetReachable: true });
  let subscriptionIndex = 0;
  const subscriptions = new SubscriptionRegistry({
    eventBus,
    idFactory: () => `subscription-${subscriptionIndex += 1}`,
    now: clock.now,
  });
  subscriptions.subscribe('ride:shadow');
  subscriptions.subscribe('driver:shadow');

  const heartbeat = new RealtimeHeartbeat({
    transport,
    eventBus,
    timeoutMs: 1_000,
    idFactory: () => 'heartbeat-1',
    now: clock.now,
  });
  const manager = new RealtimeConnectionManager({
    transport,
    eventBus,
    subscriptions,
    heartbeat,
    network,
    now: clock.now,
    sleep: async () => undefined,
    reconnectPolicy: { baseDelayMs: 10, maxDelayMs: 100, jitterRatio: 0 },
  });

  await manager.connect();
  await manager.authenticate('token-1');
  await heartbeat.ping();
  clock.advance(1_100);
  const timedOut = heartbeat.checkTimeout();

  for (let index = 0; index < profile.reconnectStorm; index += 1) {
    await manager.reconnect({ immediate: false });
  }

  const reconnectCountAfterStorm = manager.getSnapshot().reconnectCount;
  await manager.pause();
  const reconnectCountBeforeDuplicate = manager.getSnapshot().reconnectCount;
  await manager.reconnect();
  const reconnectCountAfterDuplicate = manager.getSnapshot().reconnectCount;
  await manager.resume();

  network.setOnlineForTests?.(false);
  await Promise.resolve();
  network.setOnlineForTests?.(true);
  await Promise.resolve();
  await Promise.resolve();

  const snapshot = manager.getSnapshot();
  const success =
    timedOut &&
    reconnectCountAfterStorm >= profile.reconnectStorm &&
    reconnectCountAfterDuplicate === reconnectCountBeforeDuplicate &&
    snapshot.subscriptions.size === 2 &&
    transport.sendCalls.some(call => call.type === 'subscription.restore') &&
    transport.connectCalls > 0 &&
    transport.disconnectCalls > 0 &&
    transport.authenticateCalls.includes('token-1');

  return createReadinessGateResult(
    'realtime_gateway',
    success ? 'pass' : 'fail',
    [
      { name: 'reconnectStorm', value: profile.reconnectStorm, unit: 'cycles' },
      { name: 'reconnectCount', value: snapshot.reconnectCount, unit: 'cycles' },
      { name: 'heartbeatTimedOut', value: timedOut },
      { name: 'subscriptionCount', value: snapshot.subscriptions.size, unit: 'subscriptions' },
      { name: 'presence', value: snapshot.presence },
    ],
    success ? null : 'Realtime reconnect, heartbeat timeout, subscription restore, or offline/online transition failed.',
    success
      ? 'Keep reconnect and subscription restore behavior stable under network churn.'
      : 'Investigate reconnect backoff, heartbeat timeout, or subscription restore before moving ride traffic.',
    clock.now,
  );
}
