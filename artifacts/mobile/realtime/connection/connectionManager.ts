import { createListenerSet } from '@/state/storeUtils';
import { observability } from '@/observability/context/observabilityContext';
import type { RealtimeAuthProvider } from '../auth/auth';
import { RealtimeDispatcher } from '../dispatcher/dispatcher';
import type { RealtimeEventBus } from '../events/eventBus';
import type { RealtimeEventMap, RealtimeOutboundMessage } from '../events/types';
import { RealtimeHeartbeat } from '../heartbeat/heartbeat';
import type { RealtimeNetworkMonitor, RealtimeNetworkState } from '../network/networkMonitor';
import type { RealtimePresenceState } from '../presence/presence';
import { DEFAULT_REALTIME_RECONNECT_POLICY, getReconnectDelayMs, type RealtimeReconnectPolicy } from '../retry/backoff';
import { SubscriptionRegistry } from '../subscriptions/subscriptionRegistry';
import type { RealtimeTransport } from './transport';

export interface RealtimeConnectionSnapshot {
  presence: RealtimePresenceState;
  previousPresence: RealtimePresenceState;
  paused: boolean;
  destroyed: boolean;
  reconnectCount: number;
  nextReconnectAt: string | null;
  lastError: string | null;
  network: RealtimeNetworkState;
  heartbeat: ReturnType<RealtimeHeartbeat['getSnapshot']>;
  subscriptions: ReturnType<SubscriptionRegistry['getSnapshot']>;
}

export interface RealtimeConnectionManagerOptions {
  transport: RealtimeTransport;
  eventBus: RealtimeEventBus<RealtimeEventMap>;
  subscriptions?: SubscriptionRegistry;
  heartbeat?: RealtimeHeartbeat;
  dispatcher?: RealtimeDispatcher;
  network?: RealtimeNetworkMonitor;
  authProvider?: RealtimeAuthProvider;
  reconnectPolicy?: Partial<RealtimeReconnectPolicy>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class RealtimeConnectionManager {
  private presence: RealtimePresenceState = 'Offline';
  private previousPresence: RealtimePresenceState = 'Offline';
  private paused = false;
  private destroyed = false;
  private reconnectCount = 0;
  private nextReconnectAt: string | null = null;
  private lastError: string | null = null;
  private network: RealtimeNetworkState = { isOnline: true, isInternetReachable: true };
  private readonly listeners = createListenerSet<RealtimeConnectionSnapshot>();
  private readonly transport: RealtimeTransport;
  private readonly eventBus: RealtimeEventBus<RealtimeEventMap>;
  private readonly subscriptions: SubscriptionRegistry;
  private readonly heartbeat: RealtimeHeartbeat;
  private readonly dispatcher: RealtimeDispatcher;
  private readonly authProvider?: RealtimeAuthProvider;
  private readonly reconnectPolicy: RealtimeReconnectPolicy;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private unsubscribeTransport: (() => void) | null = null;
  private unsubscribeNetwork: (() => void) | null = null;
  private shouldReconnectWhenOnline = false;

  constructor(options: RealtimeConnectionManagerOptions) {
    this.transport = options.transport;
    this.eventBus = options.eventBus;
    this.subscriptions = options.subscriptions ?? new SubscriptionRegistry({ eventBus: options.eventBus });
    this.heartbeat = options.heartbeat ?? new RealtimeHeartbeat({ transport: options.transport, eventBus: options.eventBus });
    this.dispatcher = options.dispatcher ?? new RealtimeDispatcher({ eventBus: options.eventBus, heartbeat: this.heartbeat });
    this.authProvider = options.authProvider;
    this.reconnectPolicy = { ...DEFAULT_REALTIME_RECONNECT_POLICY, ...options.reconnectPolicy };
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.network = options.network?.getSnapshot() ?? this.network;

    if (typeof this.transport.subscribe === 'function') {
      this.unsubscribeTransport = this.transport.subscribe(message => this.dispatcher.dispatch(message));
    }
    if (options.network) {
      this.unsubscribeNetwork = options.network.subscribe(state => this.setNetworkState(state));
    }
  }

  subscribe(listener: (snapshot: RealtimeConnectionSnapshot) => void) {
    return this.listeners.add(listener);
  }

  getSnapshot(): RealtimeConnectionSnapshot {
    return {
      presence: this.presence,
      previousPresence: this.previousPresence,
      paused: this.paused,
      destroyed: this.destroyed,
      reconnectCount: this.reconnectCount,
      nextReconnectAt: this.nextReconnectAt,
      lastError: this.lastError,
      network: this.network,
      heartbeat: this.heartbeat.getSnapshot(),
      subscriptions: this.subscriptions.getSnapshot(),
    };
  }

  async connect() {
    observability.metrics.counter('realtime.connect');
    if (this.destroyed || this.paused || !this.network.isOnline) return this.getSnapshot();
    this.setPresence('Connecting');
    try {
      await this.transport.connect();
      this.lastError = null;
      this.nextReconnectAt = null;
      this.setPresence('Connected');
      this.heartbeat.start();
      await this.restoreSubscriptions();
    } catch (error) {
      observability.metrics.counter('realtime.connect.error');
      this.lastError = serializeError(error);
      this.setPresence('Degraded');
      throw error;
    }
    return this.getSnapshot();
  }

  async authenticate(token?: string | null) {
    observability.metrics.counter('realtime.authenticate');
    if (this.destroyed || this.paused || !this.network.isOnline) return this.getSnapshot();
    const resolvedToken = token ?? await this.authProvider?.getToken();
    if (!resolvedToken) return this.getSnapshot();
    if (this.transport.authenticate) {
      await this.transport.authenticate(resolvedToken);
    } else {
      await this.transport.send({ type: 'auth.authenticate', payload: { token: resolvedToken } });
    }
    this.setPresence('Authenticated');
    return this.getSnapshot();
  }

  async disconnect() {
    observability.metrics.counter('realtime.disconnect');
    this.heartbeat.stop();
    await this.transport.disconnect();
    this.setPresence('Disconnected');
    return this.getSnapshot();
  }

  async reconnect(options: { immediate?: boolean } = {}) {
    observability.metrics.counter('realtime.reconnect');
    if (this.destroyed || this.paused || !this.network.isOnline) return this.getSnapshot();
    this.reconnectCount += 1;
    this.setPresence('Reconnecting');
    const delay = getReconnectDelayMs(this.reconnectCount, this.reconnectPolicy);
    this.nextReconnectAt = new Date(this.now().getTime() + delay).toISOString();
    this.notifyConnection();
    if (options.immediate === false) {
      await this.sleep(delay);
    }
    await this.transport.disconnect();
    await this.connect();
    return this.getSnapshot();
  }

  async pause() {
    this.paused = true;
    this.heartbeat.stop();
    await this.transport.disconnect();
    this.setPresence(this.network.isOnline ? 'Disconnected' : 'Offline');
    return this.getSnapshot();
  }

  async resume() {
    this.paused = false;
    if (!this.network.isOnline) {
      this.setPresence('Offline');
      return this.getSnapshot();
    }
    return this.connect();
  }

  async destroy() {
    this.destroyed = true;
    this.paused = true;
    this.heartbeat.stop();
    this.unsubscribeTransport?.();
    this.unsubscribeNetwork?.();
    await this.transport.disconnect();
    this.setPresence('Disconnected');
    return this.getSnapshot();
  }

  async send(message: RealtimeOutboundMessage) {
    await this.transport.send(message);
  }

  setNetworkState(network: RealtimeNetworkState) {
    this.network = network;
    if (!network.isOnline) {
      this.shouldReconnectWhenOnline = ['Connected', 'Authenticated', 'Reconnecting', 'Connecting'].includes(this.presence);
      this.heartbeat.stop();
      void this.transport.disconnect();
      this.setPresence('Offline');
      return;
    }
    if (this.presence === 'Offline') {
      this.setPresence('Disconnected');
    }
    if (this.shouldReconnectWhenOnline && !this.paused && !this.destroyed) {
      this.shouldReconnectWhenOnline = false;
      void this.reconnect();
    }
    this.notifyConnection();
  }

  private async restoreSubscriptions() {
    const subscriptions = this.subscriptions.getSnapshot().subscriptions;
    await Promise.all(subscriptions.map(subscription =>
      this.transport.send({
        type: 'subscription.restore',
        payload: { id: subscription.id, topic: subscription.topic, params: subscription.params },
      }),
    ));
  }

  private setPresence(next: RealtimePresenceState) {
    if (this.presence === next) {
      this.notifyConnection();
      return;
    }
    const previous = this.presence;
    this.previousPresence = previous;
    this.presence = next;
    const at = this.now().toISOString();
    this.eventBus.publish('realtime.presence', { state: next, previousState: previous, at });
    this.eventBus.publish('realtime.connection', {
      state: next,
      reconnectCount: this.reconnectCount,
      reason: this.lastError ?? undefined,
    });
    this.notifyConnection();
  }

  private notifyConnection() {
    this.listeners.notify(this.getSnapshot());
  }
}
