import type { RealtimeEventBus } from '../events/eventBus';
import type { RealtimeEventMap, RealtimeInboundMessage } from '../events/types';
import type { RealtimeHeartbeat } from '../heartbeat/heartbeat';

export interface RealtimeDispatcherOptions {
  eventBus: RealtimeEventBus<RealtimeEventMap>;
  heartbeat?: RealtimeHeartbeat;
  now?: () => Date;
}

export class RealtimeDispatcher {
  private readonly eventBus: RealtimeEventBus<RealtimeEventMap>;
  private readonly heartbeat?: RealtimeHeartbeat;
  private readonly now: () => Date;

  constructor(options: RealtimeDispatcherOptions) {
    this.eventBus = options.eventBus;
    this.heartbeat = options.heartbeat;
    this.now = options.now ?? (() => new Date());
  }

  dispatch(message: RealtimeInboundMessage) {
    if (message.type === 'heartbeat.pong') {
      this.heartbeat?.pong(message.sentAt);
      return;
    }

    this.eventBus.publish('realtime.dispatch', {
      type: message.type,
      payload: message.payload,
      receivedAt: message.receivedAt ?? this.now().toISOString(),
    });
  }
}
