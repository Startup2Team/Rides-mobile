import { createListenerSet } from '@/state/storeUtils';
import type { RealtimeEventBus } from '../events/eventBus';
import type { RealtimeEventMap } from '../events/types';

export interface RealtimeSubscription<TParams = Record<string, unknown>> {
  id: string;
  topic: string;
  params?: TParams;
  createdAt: string;
}

export interface SubscriptionRegistrySnapshot {
  subscriptions: RealtimeSubscription[];
  size: number;
}

export interface SubscriptionRegistryOptions {
  eventBus?: RealtimeEventBus<RealtimeEventMap>;
  idFactory?: () => string;
  now?: () => Date;
}

function defaultIdFactory() {
  return `subscription_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SubscriptionRegistry {
  private readonly subscriptions = new Map<string, RealtimeSubscription>();
  private readonly listeners = createListenerSet<SubscriptionRegistrySnapshot>();
  private readonly eventBus?: RealtimeEventBus<RealtimeEventMap>;
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(options: SubscriptionRegistryOptions = {}) {
    this.eventBus = options.eventBus;
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
  }

  subscribe<TParams>(topic: string, params?: TParams) {
    const subscription: RealtimeSubscription<TParams> = {
      id: this.idFactory(),
      topic,
      params,
      createdAt: this.now().toISOString(),
    };
    this.subscriptions.set(subscription.id, subscription as RealtimeSubscription);
    this.eventBus?.publish('realtime.subscription', {
      action: 'subscribe',
      topic,
      subscriptionId: subscription.id,
    });
    this.notify();
    return subscription;
  }

  unsubscribe(id: string) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return false;
    this.subscriptions.delete(id);
    this.eventBus?.publish('realtime.subscription', {
      action: 'unsubscribe',
      topic: subscription.topic,
      subscriptionId: subscription.id,
    });
    this.notify();
    return true;
  }

  unsubscribeAll() {
    this.subscriptions.clear();
    this.notify();
  }

  restoreSubscriptions(subscriptions: RealtimeSubscription[]) {
    this.subscriptions.clear();
    subscriptions.forEach(subscription => this.subscriptions.set(subscription.id, subscription));
    subscriptions.forEach(subscription => {
      this.eventBus?.publish('realtime.subscription', {
        action: 'restore',
        topic: subscription.topic,
        subscriptionId: subscription.id,
      });
    });
    this.notify();
    return this.getSnapshot().subscriptions;
  }

  getSnapshot(): SubscriptionRegistrySnapshot {
    const subscriptions = [...this.subscriptions.values()].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return { subscriptions, size: subscriptions.length };
  }

  subscribeToChanges(listener: (snapshot: SubscriptionRegistrySnapshot) => void) {
    return this.listeners.add(listener);
  }

  private notify() {
    this.listeners.notify(this.getSnapshot());
  }
}
