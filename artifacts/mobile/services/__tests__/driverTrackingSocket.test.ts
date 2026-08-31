import { openDriverSocket } from '../driverTrackingSocket';

jest.mock('@/persistence/authTokens', () => ({
  getAccessToken: jest.fn(async () => 'token-123'),
}));

// A minimal fake of RN's WebSocket — see services/__tests__/customerTrackingSocket.test.ts
// for the identical rationale; kept duplicated here rather than shared so each
// tracking socket's regression suite stands alone.
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

describe('openDriverSocket read-idle watchdog', () => {
  test('force-closes the socket when no inbound frame arrives within the idle window', async () => {
    openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);

    const socket = instances[0];
    socket.simulateOpen();
    expect(socket.closeSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1);
    expect(socket.closeSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(socket.closeSpy).toHaveBeenCalledTimes(1);
  });

  test('an inbound message resets the idle window so a healthy socket never trips it', async () => {
    openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);

    const socket = instances[0];
    socket.simulateOpen();

    for (let i = 0; i < 5; i += 1) {
      await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS - 1_000);
      socket.simulateMessage({ type: 'driver_location', payload: { lat: 1, lng: 2 } });
    }
    expect(socket.closeSpy).not.toHaveBeenCalled();
  });

  test('the forced close reconnects through the existing backoff (not a dead end)', async () => {
    openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    await jest.advanceTimersByTimeAsync(READ_IDLE_TIMEOUT_MS);
    await jest.advanceTimersByTimeAsync(1_000);

    expect(instances).toHaveLength(2);
  });
});

describe('openDriverSocket close()', () => {
  test('caller-initiated close does not reconnect and stops the watchdog', async () => {
    const handle = openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    handle.close();
    expect(instances[0].closeSpy).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(120_000);
    expect(instances).toHaveLength(1);
  });
});

describe('openDriverSocket ensureAlive()', () => {
  test('reconnects immediately (skipping backoff) when not currently connected', async () => {
    const handle = openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].onclose?.();
    expect(instances).toHaveLength(1);

    handle.ensureAlive?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(instances).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(instances).toHaveLength(2);
  });

  test('is a no-op while the socket is already open', async () => {
    const handle = openDriverSocket({ onEvent: jest.fn() });
    await jest.advanceTimersByTimeAsync(0);
    instances[0].simulateOpen();

    handle.ensureAlive?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(instances).toHaveLength(1);
  });
});
