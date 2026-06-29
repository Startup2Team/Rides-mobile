import { createListenerSet } from '@/state/storeUtils';
import type { RealtimeEventBus } from '../events/eventBus';
import type { RealtimeEventMap, RealtimeOutboundMessage } from '../events/types';

export interface HeartbeatTransport {
  send(message: RealtimeOutboundMessage): Promise<void>;
}

export interface HeartbeatSnapshot {
  lastPingAt: string | null;
  lastPongAt: string | null;
  latencyMs: number | null;
  timedOut: boolean;
  running: boolean;
}

export interface HeartbeatOptions {
  transport: HeartbeatTransport;
  eventBus?: RealtimeEventBus<RealtimeEventMap>;
  timeoutMs?: number;
  idFactory?: () => string;
  now?: () => Date;
}

function defaultIdFactory() {
  return `heartbeat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class RealtimeHeartbeat {
  private snapshot: HeartbeatSnapshot = {
    lastPingAt: null,
    lastPongAt: null,
    latencyMs: null,
    timedOut: false,
    running: false,
  };
  private readonly listeners = createListenerSet<HeartbeatSnapshot>();
  private readonly transport: HeartbeatTransport;
  private readonly eventBus?: RealtimeEventBus<RealtimeEventMap>;
  private readonly timeoutMs: number;
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(options: HeartbeatOptions) {
    this.transport = options.transport;
    this.eventBus = options.eventBus;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
  }

  start() {
    this.snapshot = { ...this.snapshot, running: true, timedOut: false };
    this.notify();
  }

  stop() {
    this.snapshot = { ...this.snapshot, running: false };
    this.notify();
  }

  async ping() {
    const sentAt = this.now().toISOString();
    this.snapshot = { ...this.snapshot, lastPingAt: sentAt, timedOut: false };
    await this.transport.send({ type: 'heartbeat.ping', id: this.idFactory(), sentAt });
    this.eventBus?.publish('realtime.heartbeat', { kind: 'ping', latencyMs: this.snapshot.latencyMs, at: sentAt });
    this.notify();
    return sentAt;
  }

  pong(sentAt?: string) {
    const now = this.now();
    const pingAt = sentAt ?? this.snapshot.lastPingAt;
    const latencyMs = pingAt ? Math.max(0, now.getTime() - new Date(pingAt).getTime()) : null;
    const pongAt = now.toISOString();
    this.snapshot = {
      ...this.snapshot,
      lastPongAt: pongAt,
      latencyMs,
      timedOut: false,
    };
    this.eventBus?.publish('realtime.heartbeat', {
      kind: 'pong',
      latencyMs,
      at: pongAt,
    });
    this.notify();
    return latencyMs;
  }

  checkTimeout() {
    if (!this.snapshot.lastPingAt) return false;
    const lastPong = this.snapshot.lastPongAt ? new Date(this.snapshot.lastPongAt).getTime() : 0;
    const lastPing = new Date(this.snapshot.lastPingAt).getTime();
    const timedOut = lastPing >= lastPong && this.now().getTime() - lastPing >= this.timeoutMs;
    if (timedOut && !this.snapshot.timedOut) {
      const at = this.now().toISOString();
      this.snapshot = { ...this.snapshot, timedOut: true };
      this.eventBus?.publish('realtime.heartbeat', { kind: 'timeout', latencyMs: this.snapshot.latencyMs, at });
      this.notify();
    }
    return timedOut;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: HeartbeatSnapshot) => void) {
    return this.listeners.add(listener);
  }

  private notify() {
    this.listeners.notify(this.snapshot);
  }
}
