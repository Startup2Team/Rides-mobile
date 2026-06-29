import { createListenerSet } from '@/state/storeUtils';
import type { RealtimeEventMap, RealtimeEventName, RealtimeEventPayload } from './types';

export type RealtimeEventListener<TEvent extends RealtimeEventName> = (payload: RealtimeEventPayload<TEvent>) => void;

export class RealtimeEventBus<TEvents extends RealtimeEventMap = RealtimeEventMap> {
  private readonly listeners = new Map<keyof TEvents, ReturnType<typeof createListenerSet<any>>>();

  publish<TEvent extends keyof TEvents>(event: TEvent, payload: TEvents[TEvent]) {
    this.listeners.get(event)?.notify(payload);
  }

  subscribe<TEvent extends keyof TEvents>(event: TEvent, listener: (payload: TEvents[TEvent]) => void) {
    const listenerSet = this.getListenerSet(event);
    return listenerSet.add(listener);
  }

  unsubscribe<TEvent extends keyof TEvents>(event: TEvent, listener: (payload: TEvents[TEvent]) => void) {
    const listenerSet = this.listeners.get(event);
    if (!listenerSet) return;
    listenerSet.add(listener)();
  }

  clear() {
    this.listeners.forEach(listenerSet => listenerSet.clear());
    this.listeners.clear();
  }

  private getListenerSet<TEvent extends keyof TEvents>(event: TEvent) {
    let listenerSet = this.listeners.get(event);
    if (!listenerSet) {
      listenerSet = createListenerSet<TEvents[TEvent]>();
      this.listeners.set(event, listenerSet);
    }
    return listenerSet;
  }
}
