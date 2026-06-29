import type { DomainEvent } from '../types';

export type DomainEventListener<TEvent extends DomainEvent = DomainEvent> = (event: TEvent) => void | Promise<void>;

export class DomainEventBus {
  private readonly globalListeners = new Set<DomainEventListener>();
  private readonly typedListeners = new Map<string, Set<DomainEventListener>>();

  async publish<TEvent extends DomainEvent>(event: TEvent) {
    const typed = this.typedListeners.get(event.eventType);
    if (typed) {
      await Promise.all([...typed].map(listener => listener(event)));
    }
    await Promise.all([...this.globalListeners].map(listener => listener(event)));
  }

  subscribe<TEvent extends DomainEvent = DomainEvent>(
    eventType: string | '*',
    listener: DomainEventListener<TEvent>,
  ) {
    if (eventType === '*') {
      this.globalListeners.add(listener as DomainEventListener);
      return () => this.unsubscribe('*', listener);
    }

    const listeners = this.getTypedListeners(eventType);
    listeners.add(listener as DomainEventListener);
    return () => this.unsubscribe(eventType, listener);
  }

  unsubscribe<TEvent extends DomainEvent = DomainEvent>(eventType: string | '*', listener: DomainEventListener<TEvent>) {
    if (eventType === '*') {
      this.globalListeners.delete(listener as DomainEventListener);
      return;
    }
    this.typedListeners.get(eventType)?.delete(listener as DomainEventListener);
  }

  unsubscribeAll(eventType?: string) {
    if (!eventType) {
      this.globalListeners.clear();
      this.typedListeners.clear();
      return;
    }
    if (eventType === '*') {
      this.globalListeners.clear();
      return;
    }
    this.typedListeners.delete(eventType);
  }

  private getTypedListeners(eventType: string) {
    let listeners = this.typedListeners.get(eventType);
    if (!listeners) {
      listeners = new Set();
      this.typedListeners.set(eventType, listeners);
    }
    return listeners;
  }
}
