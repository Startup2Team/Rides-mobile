import { getAccessToken } from '@/persistence/authTokens';
import { createReadIdleWatchdog } from '@/services/socketReadIdleWatchdog';

// Driver live socket: wss://<host>/api/v1/ws/driver — pushes incoming ride
// requests to match on, plus lifecycle/negotiation events for the active ride.
// Same Bearer-header auth + self-reconnect as the customer socket.

// Known event types the backend pushes on this socket. Unlike
// CUSTOMER_TRACKING_EVENT_TYPES this isn't consumed as a runtime allow-list
// (DriverSocketEvent.type stays a plain string so an unrecognised type never
// throws) — it exists purely so a new event type is documented in one place.
// `customer_location` mirrors `driver_location` on the customer socket: the
// customer's live position `{lat, lng}` while the ride is active, and the
// `ride_state` reconnect replay may also carry it as `customer_lat`/`customer_lng`.
export const DRIVER_SOCKET_EVENT_TYPES = [
  'ride_request',
  'ride_requested',
  'new_ride_request',
  'driver_location',
  'customer_location',
  'ride_state',
  'ride_cancelled',
  'ride_confirmed',
  'negotiation_message',
  'negotiation_declined',
  'negotiation_text',
] as const;

export type DriverSocketEventType = (typeof DRIVER_SOCKET_EVENT_TYPES)[number];

export interface DriverSocketEvent {
  type: DriverSocketEventType | string;
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
  /**
   * Best-effort nudge for a returning foreground: if the socket isn't
   * demonstrably connected (or already reconnecting), skip the remainder of
   * any pending backoff delay and reconnect right away instead of waiting —
   * a backoff computed while the app was backgrounded can otherwise leave the
   * driver stalled for up to RECONNECT_MAX_MS after the user is back looking
   * at the screen. A no-op while already open/connecting.
   */
  ensureAlive?: () => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

// The backend pings every 54s and allows 60s before giving up on a pong
// (internal/tracking/handler.go: pongWait = 60s, pingPeriod = 54s). That
// ping/pong exchange is answered by the native WebSocket transport without
// ever reaching this JS layer, so it can't be used directly as a liveness
// signal here — instead this is a read-idle budget for actual inbound
// frames, set comfortably past the server's own cadence so a healthy
// connection (which sees ride_request/driver location/negotiation traffic
// far more often than every 70s while online) never trips it, while a
// connection that's gone silently dead gets force-closed and reconnected
// well within the driver's patience.
const READ_IDLE_TIMEOUT_MS = 70_000;

function resolveWsUrl(token: string | null): string {
  const base = (process.env.EXPO_PUBLIC_WS_BASE_URL ?? '').replace(/\/+$/, '');
  // RN WebSocket header support is unreliable; the backend also accepts the JWT
  // via a `token` query param, so we always include it.
  return token ? `${base}/ws/driver?token=${encodeURIComponent(token)}` : `${base}/ws/driver`;
}

// Best-effort: attach to the WS-level ping/pong events too, in case the
// runtime's WebSocket implementation does surface them (unlike the DOM
// standard, this isn't guaranteed — see READ_IDLE_TIMEOUT_MS's comment). A
// harmless no-op everywhere else.
function watchWireLevelPings(socket: WebSocket, onFrame: () => void): void {
  const target = socket as unknown as { addEventListener?: (type: string, listener: () => void) => void };
  try {
    target.addEventListener?.('ping', onFrame);
    target.addEventListener?.('pong', onFrame);
  } catch {
    // Not supported on this platform/runtime — the onmessage reset is the
    // primary (guaranteed) signal.
  }
}

export function openDriverSocket(handlers: DriverSocketHandlers): DriverSocket {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let connecting = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Read-idle watchdog: see READ_IDLE_TIMEOUT_MS. Forcing socket.close() here
  // triggers the existing onclose → scheduleReconnect path exactly as if the
  // platform had noticed the death itself — no separate reconnect logic.
  const watchdog = createReadIdleWatchdog(() => {
    try {
      socket?.close();
    } catch {
      // ignore — onclose (or its absence) is handled below either way.
    }
  }, READ_IDLE_TIMEOUT_MS);

  const scheduleReconnect = () => {
    if (closedByCaller) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    attempt += 1;
    reconnectTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (closedByCaller || connecting) return;
    connecting = true;
    const token = await getAccessToken().catch(() => null);
    if (closedByCaller) {
      connecting = false;
      return;
    }

    try {
      const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const Ctor = WebSocket as unknown as new (
        uri: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
      ) => WebSocket;
      socket = new Ctor(resolveWsUrl(token), undefined, options);
      watchWireLevelPings(socket, () => watchdog.reset());

      socket.onopen = () => {
        connecting = false;
        attempt = 0;
        watchdog.reset();
        handlers.onOpen?.();
      };
      socket.onmessage = event => {
        watchdog.reset();
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
        connecting = false;
        watchdog.clear();
        handlers.onClose?.(closedByCaller);
        socket = null;
        if (!closedByCaller) scheduleReconnect();
      };
    } catch (error) {
      connecting = false;
      handlers.onError?.(error);
      scheduleReconnect();
    }
  };

  void connect();

  return {
    close: () => {
      closedByCaller = true;
      watchdog.clear();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socket = null;
    },
    ensureAlive: () => {
      if (closedByCaller || connecting) return;
      if (socket && socket.readyState === WebSocket.OPEN) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      void connect();
    },
  };
}
