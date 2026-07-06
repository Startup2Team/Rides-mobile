import { getAccessToken } from '@/persistence/authTokens';

// Live customer tracking over WebSocket: wss://<host>/api/v1/ws/customer?ride_id=…
// Auth is the same Bearer token as REST (React Native's WebSocket supports the
// options.headers arg). The backend pushes ride-lifecycle + negotiation events.

export const CUSTOMER_TRACKING_EVENT_TYPES = [
  'driver_matched',
  'ride_confirmed',
  'driver_en_route',
  'driver_arrived',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'driver_location',
  'negotiation_declined',
  'negotiation_message',
] as const;

export type CustomerTrackingEventType = (typeof CUSTOMER_TRACKING_EVENT_TYPES)[number];

export interface CustomerTrackingEvent {
  type: CustomerTrackingEventType | string;
  payload: Record<string, unknown>;
}

export interface CustomerTrackingHandlers {
  onEvent: (event: CustomerTrackingEvent) => void;
  onOpen?: () => void;
  onClose?: (graceful: boolean) => void;
  onError?: (error: unknown) => void;
}

export interface CustomerTrackingSocket {
  close: () => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function resolveWsUrl(rideId: string): string {
  const base = (process.env.EXPO_PUBLIC_WS_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/ws/customer?ride_id=${encodeURIComponent(rideId)}`;
}

/**
 * Opens a self-reconnecting tracking socket for a ride. Returns immediately with
 * a handle; connection happens asynchronously (token fetch + upgrade). Call
 * close() to tear it down (stops reconnection).
 */
export function openCustomerTrackingSocket(
  rideId: string,
  handlers: CustomerTrackingHandlers,
): CustomerTrackingSocket {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReconnect = () => {
    if (closedByCaller) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    attempt += 1;
    reconnectTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (closedByCaller) return;
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }
    if (closedByCaller) return;

    try {
      const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      // RN WebSocket accepts (uri, protocols, options); the DOM type omits options.
      const Ctor = WebSocket as unknown as new (
        uri: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
      ) => WebSocket;
      socket = new Ctor(resolveWsUrl(rideId), undefined, options);

      socket.onopen = () => {
        attempt = 0;
        handlers.onOpen?.();
      };
      socket.onmessage = event => {
        try {
          const parsed = JSON.parse(String(event.data)) as { type?: string; payload?: unknown } & Record<string, unknown>;
          const { type, payload, ...rest } = parsed;
          handlers.onEvent({
            type: type ?? 'unknown',
            payload: (payload as Record<string, unknown>) ?? rest,
          });
        } catch (error) {
          handlers.onError?.(error);
        }
      };
      socket.onerror = error => handlers.onError?.(error);
      socket.onclose = () => {
        handlers.onClose?.(closedByCaller);
        socket = null;
        if (!closedByCaller) scheduleReconnect();
      };
    } catch (error) {
      handlers.onError?.(error);
      scheduleReconnect();
    }
  };

  void connect();

  return {
    close: () => {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socket = null;
    },
  };
}
