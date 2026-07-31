import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/constants/storage';
import { ForbiddenError, TimeoutError } from '@/data/remote/contracts/backendErrors';
import { saveSecureStorage } from '@/persistence/secureStorage';
import { setDriverAvailability } from '@/services/driverAvailability';
import { switchUserMode } from '@/services/userMode';
import {
  __resetRoleSyncForTests,
  clearRoleSync,
  getPendingRoleSync,
  initRoleSync,
  queueRoleSync,
  subscribeRoleSync,
  type RoleSyncEvent,
} from '@/services/roleSwitchSync';

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
jest.mock('@/services/userMode', () => ({
  switchUserMode: jest.fn(),
}));
jest.mock('@/services/driverAvailability', () => ({
  setDriverAvailability: jest.fn(),
  updateDriverLocation: jest.fn(),
}));
jest.mock('@/offline', () => ({
  offlineNetwork: { subscribe: jest.fn(() => () => {}) },
}));

const mockSwitchUserMode = switchUserMode as jest.MockedFunction<typeof switchUserMode>;
const mockSetDriverAvailability = setDriverAvailability as jest.MockedFunction<typeof setDriverAvailability>;

const flush = async () => {
  for (let i = 0; i < 8; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

describe('roleSwitchSync', () => {
  let events: RoleSyncEvent[];
  let unsubscribe: () => void;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    __resetRoleSyncForTests();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    events = [];
    unsubscribe = subscribeRoleSync(event => events.push(event));
  });

  afterEach(() => {
    unsubscribe();
    __resetRoleSyncForTests();
    jest.useRealTimers();
  });

  test('syncs the mode to the backend and clears the pending record', async () => {
    mockSwitchUserMode.mockResolvedValue(undefined);

    queueRoleSync({ mode: 'driver', driverOffline: false });
    await flush();

    expect(mockSwitchUserMode).toHaveBeenCalledWith('driver');
    expect(mockSetDriverAvailability).not.toHaveBeenCalled();
    expect(getPendingRoleSync()).toBeNull();
    expect(events).toEqual([{ type: 'synced', mode: 'driver' }]);
  });

  test('pushes the driver offline BEFORE the mode PATCH when leaving driver mode', async () => {
    mockSwitchUserMode.mockResolvedValue(undefined);
    mockSetDriverAvailability.mockResolvedValue(undefined);

    queueRoleSync({ mode: 'customer', driverOffline: true });
    await flush();

    expect(mockSetDriverAvailability).toHaveBeenCalledWith(false);
    expect(mockSetDriverAvailability.mock.invocationCallOrder[0]).toBeLessThan(
      mockSwitchUserMode.mock.invocationCallOrder[0],
    );
    expect(events).toEqual([{ type: 'synced', mode: 'customer' }]);
  });

  test('retries a transient failure with backoff until it succeeds', async () => {
    jest.useFakeTimers();
    mockSwitchUserMode
      .mockRejectedValueOnce(new TimeoutError())
      .mockResolvedValue(undefined);

    queueRoleSync({ mode: 'driver', driverOffline: false });
    await jest.advanceTimersByTimeAsync(0);

    expect(mockSwitchUserMode).toHaveBeenCalledTimes(1);
    expect(getPendingRoleSync()).not.toBeNull();
    expect(events).toEqual([]);

    await jest.advanceTimersByTimeAsync(2_000);

    expect(mockSwitchUserMode).toHaveBeenCalledTimes(2);
    expect(getPendingRoleSync()).toBeNull();
    expect(events).toEqual([{ type: 'synced', mode: 'driver' }]);
  });

  test('a refusal the backend will never accept emits failed and stops retrying', async () => {
    mockSwitchUserMode.mockRejectedValue(new ForbiddenError());

    queueRoleSync({ mode: 'driver', driverOffline: false });
    await flush();

    expect(mockSwitchUserMode).toHaveBeenCalledTimes(1);
    expect(getPendingRoleSync()).toBeNull();
    expect(events).toEqual([
      { type: 'failed', mode: 'driver', error: expect.any(ForbiddenError) },
    ]);
  });

  test('a fatal availability error does not block the mode sync', async () => {
    mockSetDriverAvailability.mockRejectedValue(new ForbiddenError());
    mockSwitchUserMode.mockResolvedValue(undefined);

    queueRoleSync({ mode: 'customer', driverOffline: true });
    await flush();

    expect(mockSwitchUserMode).toHaveBeenCalledWith('customer');
    expect(events).toEqual([{ type: 'synced', mode: 'customer' }]);
  });

  test('a newer switch supersedes an in-flight one (latest wins)', async () => {
    let resolveFirst: (() => void) | undefined;
    mockSwitchUserMode
      .mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    queueRoleSync({ mode: 'driver', driverOffline: false });
    await new Promise(resolve => setTimeout(resolve, 0));
    queueRoleSync({ mode: 'customer', driverOffline: false });
    resolveFirst?.();
    await flush();

    expect(mockSwitchUserMode).toHaveBeenLastCalledWith('customer');
    expect(getPendingRoleSync()).toBeNull();
    expect(events).toEqual([{ type: 'synced', mode: 'customer' }]);
  });

  test('clearRoleSync drops the pending record and stops retries', async () => {
    jest.useFakeTimers();
    mockSwitchUserMode.mockRejectedValue(new TimeoutError());

    queueRoleSync({ mode: 'driver', driverOffline: false });
    await jest.advanceTimersByTimeAsync(0);
    expect(getPendingRoleSync()).not.toBeNull();

    await clearRoleSync();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(getPendingRoleSync()).toBeNull();
    expect(mockSwitchUserMode).toHaveBeenCalledTimes(1);
  });

  test('initRoleSync resumes a sync a previous app run never finished', async () => {
    mockSwitchUserMode.mockResolvedValue(undefined);
    mockSetDriverAvailability.mockResolvedValue(undefined);
    await saveSecureStorage(STORAGE_KEYS.roleSync, {
      mode: 'customer',
      driverOffline: true,
      driverOfflineDone: false,
      seq: 3,
    });

    await initRoleSync();
    await flush();

    expect(mockSetDriverAvailability).toHaveBeenCalledWith(false);
    expect(mockSwitchUserMode).toHaveBeenCalledWith('customer');
    expect(getPendingRoleSync()).toBeNull();
    expect(events).toEqual([{ type: 'synced', mode: 'customer' }]);
  });
});
