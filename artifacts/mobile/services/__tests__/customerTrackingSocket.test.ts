import { openCustomerTrackingSocket } from '../customerTrackingSocket';

jest.mock('@/persistence/authTokens', () => ({
  getAccessToken: jest.fn(async () => 'token-123'),
}));

// A minimal fake of RN's WebSocket: onopen/onmessage/onerror/onclose handler
// properties (assigned, not addEventListener-based, matching how the real
// socket services wire them up), plus addEventListener/dispatch so the
// watchdog's best-effort ping/pong hook can be exercised too.
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  closeSpy = jest.fn();
  private listeners = new Map<string, Set<() => void>>();

  constructor(
    public url: string,
    public protocols?: unknown,
    public options?: unknown,
  ) {
    instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  dispatch(type: string) {
    this.listeners.get(type)?.forEach(listener => listener());
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  close() {
    this.closeSpy();
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

let instances: FakeWebSocket[] = [];

beforeEach(() => {
  instances = [];
  jest.useFakeTimers();
  (global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  jest.useRealTimers();
});

const READ_IDLE_TIMEOUT_MS = 70_000;

describe('openCustomerTrackingSocket read-idle watchdog', () => {
  test('force-closes the socket when no inbound frame arrives within the idle window', async () => {
    openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0); // flush the getAccessToken() await

    const socket = instances[0];
    socket.simulateOpen();
    expect(socket.closeSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1);
    expect(socket.closeSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(socket.closeSpy).toHaveBeenCalledTimes(1);
  });

  test('an inbound message resets the idle window so a healthy socket never trips it', async () => {
    openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);

    const socket = instances[0];
    socket.simulateOpen();

    // A message arrives just before the deadline, every cycle — the socket
    // should never be closed by the watchdog.
    for (let i = 0; i < 5; i += 1) {
      await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
      socket.simulateMessage({ type: 'driver_location', payload: { lat: 1, lng: 2 } });
    }
    expect(socket.closeSpy).not.toHaveBeenCalled();
  });

  test('an unparseable frame still counts as a live frame and resets the window', async () => {
    openCustomerTrackingSocket('ride-1', { onEvent: jest.fn(), onError: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);

    const socket = instances[0];
    socket.simulateOpen();
    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
    socket.onmessage?.({ data: 'not json' });
    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
    expect(socket.closeSpy).not.toHaveBeenCalled();
  });

  test('a wire-level pong (when the runtime surfaces it) also resets the idle window', async () => {
    openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);

    const socket = instances[0];
    socket.simulateOpen();
    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
    socket.dispatch('pong');
    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
    expect(socket.closeSpy).not.toHaveBeenCalled();
  });

  test('the forced close reconnects through the existing backoff (not a dead end)', async () => {
    openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS); // trips the watchdog → close() → onclose → scheduleReconnect
    await jest.advanceTimersByTimeAsync(1_000); // first backoff step

    expect(instances).toHaveLength(2);
  });
});

describe('openCustomerTrackingSocket close()', () => {
  test('caller-initiated close does not reconnect and stops the watchdog', async () => {
    const handle = openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    handle.close();
    expect(instances[0].closeSpy).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(120_000);
    expect(instances).toHaveLength(1); // no reconnect attempt was scheduled
  });
});

describe('openCustomerTrackingSocket ensureAlive()', () => {
  test('reconnects immediately (skipping backoff) when not currently connected', async () => {
    const handle = openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    // The connection drops without the caller closing it — the existing
    // onclose path schedules a reconnect on a ~1s backoff.
    instances[0].onclose?.();
    expect(instances).toHaveLength(1);

    // A foreground resume shouldn't wait out that backoff.
    handle.ensureAlive?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(instances).toHaveLength(2);

    // The backoff timer that was pending before ensureAlive() must not also
    // fire and open a THIRD, redundant connection.
    await jest.advanceTimersByTimeAsync(5_000);
    expect(instances).toHaveLength(2);
  });

  test('is a no-op while the socket is already open', async () => {
    const handle = openCustomerTrackingSocket('ride-1', { onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    handle.ensureAlive?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(instances).toHaveLength(1);
  });
});
