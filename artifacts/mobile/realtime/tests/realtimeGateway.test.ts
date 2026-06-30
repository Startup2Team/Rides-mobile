import { RealtimeConnectionManager } from '../connection/connectionManager';
import type { RealtimeTransport } from '../connection/transport';
import { RealtimeDispatcher } from '../dispatcher/dispatcher';
import { RealtimeEventBus } from '../events/eventBus';
import type { RealtimeInboundMessage, RealtimeOutboundMessage } from '../events/types';
import { RealtimeHeartbeat } from '../heartbeat/heartbeat';
import { createRealtimeNetworkMonitor } from '../network/networkMonitor';
import { getReconnectDelayMs } from '../retry/backoff';
import { SubscriptionRegistry } from '../subscriptions/subscriptionRegistry';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

class TestTransport implements RealtimeTransport {
  connect = jest.fn(async () => undefined);
  disconnect = jest.fn(async () => undefined);
  send = jest.fn(async (_message: RealtimeOutboundMessage) => undefined);
  authenticate = jest.fn(async (_token: string) => undefined);
  private listener: ((message: RealtimeInboundMessage) => void) | null = null;

  subscribe(listener: (message: RealtimeInboundMessage) => void) {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  emit(message: RealtimeInboundMessage) {
    this.listener?.(message);
  }
}

function createClock(value = '2026-06-29T10:00:00.000Z') {
  let current = new Date(value);
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('realtime gateway infrastructure', () => {
  test('connect, authenticate, disconnect, pause, resume, and destroy update presence', async () => {
    const transport = new TestTransport();
    const bus = new RealtimeEventBus();
    const manager = new RealtimeConnectionManager({ transport, eventBus: bus, authProvider: { getToken: () => 'token' } });

    await manager.connect();
    expect(manager.getSnapshot().presence).toBe('Connected');
    expect(transport.connect).toHaveBeenCalledTimes(1);

    await manager.authenticate();
    expect(manager.getSnapshot().presence).toBe('Authenticated');
    expect(transport.authenticate).toHaveBeenCalledWith('token');

    await manager.disconnect();
    expect(manager.getSnapshot().presence).toBe('Disconnected');

    await manager.pause();
    expect(manager.getSnapshot()).toMatchObject({ paused: true, presence: 'Disconnected' });

    await manager.resume();
    expect(manager.getSnapshot()).toMatchObject({ paused: false, presence: 'Connected' });

    await manager.destroy();
    expect(manager.getSnapshot()).toMatchObject({ destroyed: true, presence: 'Disconnected' });
  });

  test('subscription registry supports subscribe, unsubscribe, unsubscribeAll, and restore', () => {
    const registry = new SubscriptionRegistry({ idFactory: () => 'sub-1' });
    const subscription = registry.subscribe('ride:123', { includeDriver: true });

    expect(subscription).toMatchObject({ id: 'sub-1', topic: 'ride:123' });
    expect(registry.getSnapshot().size).toBe(1);
    expect(registry.unsubscribe('sub-1')).toBe(true);
    expect(registry.getSnapshot().size).toBe(0);

    registry.restoreSubscriptions([{ id: 'sub-2', topic: 'profile:user-1', createdAt: '2026-06-29T10:00:00.000Z' }]);
    expect(registry.getSnapshot().subscriptions[0]).toMatchObject({ id: 'sub-2' });

    registry.unsubscribeAll();
    expect(registry.getSnapshot().size).toBe(0);
  });

  test('heartbeat sends ping, records pong latency, and detects timeout', async () => {
    const clock = createClock();
    const transport = new TestTransport();
    const heartbeat = new RealtimeHeartbeat({
      transport,
      now: clock.now,
      timeoutMs: 5_000,
      idFactory: () => 'ping-1',
    });

    heartbeat.start();
    const sentAt = await heartbeat.ping();
    expect(transport.send).toHaveBeenCalledWith({ type: 'heartbeat.ping', id: 'ping-1', sentAt });

    clock.advance(120);
    expect(heartbeat.pong(sentAt)).toBe(120);
    expect(heartbeat.getSnapshot()).toMatchObject({ latencyMs: 120, timedOut: false });

    await heartbeat.ping();
    clock.advance(5_000);
    expect(heartbeat.checkTimeout()).toBe(true);
    expect(heartbeat.getSnapshot().timedOut).toBe(true);
  });

  test('dispatcher publishes typed events and routes heartbeat pong messages', () => {
    const clock = createClock();
    const transport = new TestTransport();
    const bus = new RealtimeEventBus();
    const heartbeat = new RealtimeHeartbeat({ transport, now: clock.now });
    const dispatcher = new RealtimeDispatcher({ eventBus: bus, heartbeat, now: clock.now });
    const received = jest.fn();

    bus.subscribe('realtime.dispatch', received);
    dispatcher.dispatch({ type: 'profile.updated', payload: { name: 'Alice' } });
    expect(received).toHaveBeenCalledWith({
      type: 'profile.updated',
      payload: { name: 'Alice' },
      receivedAt: '2026-06-29T10:00:00.000Z',
    });

    heartbeat.start();
    void heartbeat.ping();
    clock.advance(50);
    dispatcher.dispatch({ type: 'heartbeat.pong', sentAt: '2026-06-29T10:00:00.000Z' });
    expect(heartbeat.getSnapshot().latencyMs).toBe(50);
  });

  test('reconnect uses exponential backoff and restores subscriptions', async () => {
    const clock = createClock();
    const transport = new TestTransport();
    const bus = new RealtimeEventBus();
    const subscriptions = new SubscriptionRegistry({ eventBus: bus, idFactory: () => 'sub-1', now: clock.now });
    subscriptions.subscribe('driver:1');
    const manager = new RealtimeConnectionManager({
      transport,
      eventBus: bus,
      subscriptions,
      now: clock.now,
      sleep: async () => undefined,
      reconnectPolicy: { baseDelayMs: 1_000, maxDelayMs: 10_000 },
    });

    await manager.reconnect({ immediate: false });

    expect(manager.getSnapshot()).toMatchObject({
      presence: 'Connected',
      reconnectCount: 1,
      nextReconnectAt: null,
    });
    expect(transport.disconnect).toHaveBeenCalled();
    expect(transport.connect).toHaveBeenCalled();
    expect(transport.send).toHaveBeenCalledWith({
      type: 'subscription.restore',
      payload: { id: 'sub-1', topic: 'driver:1', params: undefined },
    });
    expect(getReconnectDelayMs(3, { baseDelayMs: 1_000, maxDelayMs: 10_000, jitterRatio: 0 })).toBe(4_000);
  });

  test('network offline pauses reconnect and online resumes when previously connected', async () => {
    const transport = new TestTransport();
    const bus = new RealtimeEventBus();
    const network = createRealtimeNetworkMonitor();
    const manager = new RealtimeConnectionManager({ transport, eventBus: bus, network });

    await manager.connect();
    network.setOnlineForTests?.(false);

    expect(manager.getSnapshot().presence).toBe('Offline');

    network.setOnlineForTests?.(true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.connect).toHaveBeenCalledTimes(2);
    expect(manager.getSnapshot().presence).toBe('Connected');
  });

  test('event bus supports publish, subscribe, and unsubscribe', () => {
    const bus = new RealtimeEventBus();
    const listener = jest.fn();
    const unsubscribe = bus.subscribe('realtime.connection', listener);

    bus.publish('realtime.connection', { state: 'Connected', reconnectCount: 0 });
    unsubscribe();
    bus.publish('realtime.connection', { state: 'Disconnected', reconnectCount: 0 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ state: 'Connected', reconnectCount: 0 });
  });
});
