import type { RealtimePresenceState } from '../presence/presence';

export interface RealtimeConnectionEvent {
  state: RealtimePresenceState;
  reconnectCount: number;
  reason?: string;
}

export interface RealtimeHeartbeatEvent {
  kind: 'ping' | 'pong' | 'timeout';
  latencyMs: number | null;
  at: string;
}

export interface RealtimeSubscriptionEvent {
  action: 'subscribe' | 'unsubscribe' | 'restore';
  topic: string;
  subscriptionId: string;
}

export interface RealtimeDispatcherEvent<TPayload = unknown> {
  type: string;
  payload: TPayload;
  receivedAt: string;
}

export interface RealtimePresenceEvent {
  state: RealtimePresenceState;
  previousState: RealtimePresenceState;
  at: string;
}

export interface RealtimeEventMap {
  'realtime.connection': RealtimeConnectionEvent;
  'realtime.heartbeat': RealtimeHeartbeatEvent;
  'realtime.subscription': RealtimeSubscriptionEvent;
  'realtime.dispatch': RealtimeDispatcherEvent;
  'realtime.presence': RealtimePresenceEvent;
}

export type RealtimeEventName = keyof RealtimeEventMap;
export type RealtimeEventPayload<TEvent extends RealtimeEventName> = RealtimeEventMap[TEvent];

export interface RealtimeInboundMessage<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  id?: string;
  sentAt?: string;
  receivedAt?: string;
}

export interface RealtimeOutboundMessage<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  id?: string;
  sentAt?: string;
}
