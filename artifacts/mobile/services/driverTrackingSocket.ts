import { getAccessToken } from '@/persistence/authTokens';

// Driver live socket: wss://<host>/api/v1/ws/driver — pushes incoming ride
// requests to match on, plus lifecycle/negotiation events for the active ride.
// Same Bearer-header auth + self-reconnect as the customer socket.

export interface DriverSocketEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface DriverSocketHandlers {
  onEvent: (event: DriverSocketEvent) => void;
  onOpen?: () => void;
  onClose?: (graceful: boolean) => void;
  onError?: (error: unknown) => void;
}

export interface DriverSocket {
  close: () => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function resolveWsUrl(token: string | null): string {
  const base = (process.env.EXPO_PUBLIC_WS_BASE_URL ?? '').replace(/\/+$/, '');
  // RN WebSocket header support is unreliable; the backend also accepts the JWT
  // via a `token` query param, so we always include it.
  return token ? `${base}/ws/driver?token=${encodeURIComponent(token)}` : `${base}/ws/driver`;
}

export function openDriverSocket(handlers: DriverSocketHandlers): DriverSocket {
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
    const token = await getAccessToken().catch(() => null);
    if (closedByCaller) return;

    try {
      const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const Ctor = WebSocket as unknown as new (
        uri: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
      ) => WebSocket;
      socket = new Ctor(resolveWsUrl(token), undefined, options);

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
