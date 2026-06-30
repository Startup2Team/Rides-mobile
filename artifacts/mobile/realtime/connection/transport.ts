import type { RealtimeInboundMessage, RealtimeOutboundMessage } from '../events/types';

export interface RealtimeTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: RealtimeOutboundMessage): Promise<void>;
  authenticate?(token: string): Promise<void>;
  subscribe?(listener: (message: RealtimeInboundMessage) => void): () => void;
}

export function createNoopRealtimeTransport(): RealtimeTransport {
  return {
    async connect() {
      return undefined;
    },
    async disconnect() {
      return undefined;
    },
    async send() {
      return undefined;
    },
    async authenticate() {
      return undefined;
    },
    subscribe() {
      return () => undefined;
    },
  };
}
