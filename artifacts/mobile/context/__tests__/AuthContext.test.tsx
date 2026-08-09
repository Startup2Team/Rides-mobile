import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import { loadStoredDriverProfile } from '@/persistence/authPersistence';
import { getSecureStorageKey, saveSecureStorage } from '@/persistence/secureStorage';
import { AuthProvider, useAuth } from '../AuthContext';
import type { RoleSwitchResult } from '../AuthContext';
import { toLocalDateString } from '@/domains/driver-statistics/driverDailyGoals';
import { saveAuthTokens } from '@/persistence/authTokens';
import { queueRoleSync } from '@/services/roleSwitchSync';
import { resetAppModeStore } from '@/state/appModeStore';
import { resetRideActivity, setRideActivity } from '@/state/rideActivityStore';
import type { DriverProfile, User } from '@/types';

// Minimal react-native surface for this suite: the real AppState/Alert reach
// into native modules, which don't exist under node.
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
}));

jest.mock('@/services/roleSwitchSync', () => ({
  initRoleSync: jest.fn(async () => {}),
  queueRoleSync: jest.fn(),
  clearRoleSync: jest.fn(async () => {}),
  subscribeRoleSync: jest.fn(() => () => {}),
}));

// Unit tests exercise the LOCAL state logic; the backend availability call is
// transport-level and would always fail (and roll the state back) under node.
jest.mock('@/services/driverAvailability', () => ({
  setDriverAvailability: jest.fn(async () => {}),
  updateDriverLocation: jest.fn(async () => {}),
}));

jest.mock('@/services/pushRegistration', () => ({
  configurePushNotifications: jest.fn(),
  registerPushToken: jest.fn(async () => {}),
  resetPushRegistration: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const baseProfile: DriverProfile = {
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  licenseNumber: 'LIC001',
  province: 'Kigali',
  district: 'Gasabo',
  sector: 'Kimironko',
  momoCode: '0781234567',
  momoProvider: 'mtn',
  dob: '1990-01-01',
  isOnline: false,
  isVerified: true,
  acceptanceRate: 100,
  completedRides: 0,
  dailyRides: 0,
  dailyDeclines: 0,
  // Stamped as today so the daily rollover is a no-op — these tests are about
  // counting within a day. The rollover itself is covered separately, both in
  // domain/__tests__/driverDailyCounters.test.ts and below.
  dailyCountersDate: toLocalDateString(new Date()),
  policyAccepted: true,
  earningsTotal: 0,
  verificationStatus: 'approved',
};

describe('AuthProvider secure logout cleanup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.restoreAllMocks();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  test('logout removes secure records and legacy AsyncStorage copies', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await Promise.all(SENSITIVE_STORAGE_KEYS.map(async key => {
      await saveSecureStorage(
        key,
        key === STORAGE_KEYS.rideHistory ? { private: key.repeat(1_000) } : { private: key },
      );
      await AsyncStorage.setItem(key, `legacy-${key}`);
    }));

    await act(async () => {
      await result.current.logout();
    });

    for (const key of SENSITIVE_STORAGE_KEYS) {
      await expect(SecureStore.getItemAsync(getSecureStorageKey(key))).resolves.toBeNull();
      await expect(AsyncStorage.getItem(key)).resolves.toBeNull();
    }
  });
});

describe('setDriverOnline', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.restoreAllMocks();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  test('uses driverProfile.isOnline as the profile-backed online source', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveDriverProfile(baseProfile);
    });
    await act(async () => {
      await result.current.setDriverOnline(true);
    });

    expect(result.current.driverProfile?.isOnline).toBe(true);
    expect(result.current.driverProfile?.onlineVehicleSession).toEqual(expect.objectContaining({
      vehicleType: 'moto',
      startedAt: expect.any(String),
    }));

    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({
        isOnline: true,
        onlineVehicleSession: expect.objectContaining({
          vehicleType: 'moto',
        }),
      }),
    });
  });

  test('does nothing if no driverProfile exists yet', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setDriverOnline(true);
    });

    expect(result.current.driverProfile).toBeNull();
  });

  test('clears the online session when going offline', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveDriverProfile(baseProfile);
    });
    await act(async () => {
      await result.current.setDriverOnline(true);
    });
    await act(async () => {
      await result.current.setDriverOnline(false);
    });

    expect(result.current.driverProfile?.isOnline).toBe(false);
    expect(result.current.driverProfile?.onlineVehicleSession).toBeNull();
  });
});

describe('recordCompletedRide', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.restoreAllMocks();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  async function setupWithProfile(profile: DriverProfile) {
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await act(async () => {
      await hook.result.current.saveDriverProfile(profile);
    });
    return hook;
  }

  test('increments completedRides and dailyRides by 1', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, completedRides: 3, dailyRides: 1 });

    await act(async () => {
      await result.current.recordCompletedRide(2500);
    });

    expect(result.current.driverProfile?.completedRides).toBe(4);
    expect(result.current.driverProfile?.dailyRides).toBe(2);
  });

  test('adds the actual agreedFare to earningsTotal', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, earningsTotal: 10000 });

    await act(async () => {
      await result.current.recordCompletedRide(3500);
    });

    expect(result.current.driverProfile?.earningsTotal).toBe(13500);
  });

  test('accumulates earnings across multiple completed rides', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, earningsTotal: 0 });

    await act(async () => { await result.current.recordCompletedRide(2000); });
    await act(async () => { await result.current.recordCompletedRide(1500); });
    await act(async () => { await result.current.recordCompletedRide(3000); });

    expect(result.current.driverProfile?.earningsTotal).toBe(6500);
    expect(result.current.driverProfile?.completedRides).toBe(3);
  });

  test('does not add negative fare to earningsTotal', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, earningsTotal: 5000 });

    await act(async () => {
      await result.current.recordCompletedRide(-999);
    });

    expect(result.current.driverProfile?.earningsTotal).toBe(5000);
  });

  test('counts completed rides without inventing earnings when fare is missing', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, completedRides: 7, dailyRides: 2, earningsTotal: 9000 });

    await act(async () => {
      await result.current.recordCompletedRide();
    });

    expect(result.current.driverProfile?.completedRides).toBe(8);
    expect(result.current.driverProfile?.dailyRides).toBe(3);
    expect(result.current.driverProfile?.earningsTotal).toBe(9000);
  });

  test('does not add non-finite fare values to earningsTotal', async () => {
    const { result } = await setupWithProfile({ ...baseProfile, earningsTotal: 5000 });

    await act(async () => {
      await result.current.recordCompletedRide(Number.NaN);
    });

    expect(result.current.driverProfile?.completedRides).toBe(1);
    expect(result.current.driverProfile?.earningsTotal).toBe(5000);
  });

  test('recomputes acceptanceRate based on dailyRides and dailyDeclines', async () => {
    // 3 declines, 0 completed so far → after 1 completion: 1 ride / (1+3) = 25%
    const { result } = await setupWithProfile({ ...baseProfile, dailyRides: 0, dailyDeclines: 3 });

    await act(async () => {
      await result.current.recordCompletedRide(2000);
    });

    expect(result.current.driverProfile?.acceptanceRate).toBe(25);
  });

  test('a ride completed on a new day starts that day at 1', async () => {
    // The counters used to be incremented only, so yesterday's total carried
    // into today and grew for the life of the install.
    const { result } = await setupWithProfile({
      ...baseProfile,
      completedRides: 40,
      dailyRides: 9,
      dailyDeclines: 6,
      dailyCountersDate: '2020-01-01',
    });

    await act(async () => {
      await result.current.recordCompletedRide(2000);
    });

    expect(result.current.driverProfile?.dailyRides).toBe(1);
    expect(result.current.driverProfile?.dailyDeclines).toBe(0);
    // Lifetime totals are untouched by the rollover.
    expect(result.current.driverProfile?.completedRides).toBe(41);
  });

  test('does nothing if no driverProfile is set', async () => {
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    await act(async () => {
      await hook.result.current.recordCompletedRide(2000);
    });

    expect(hook.result.current.driverProfile).toBeNull();
  });
});

describe('switchMode', () => {
  const baseUser: User = {
    id: 'u1',
    name: 'Test User',
    phone: '0780000000',
    mode: 'customer',
    isDriver: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.clearAllMocks();
    resetAppModeStore();
    resetRideActivity();
  });

  async function seedAuthedUser(mode: User['mode'] = 'customer') {
    await saveSecureStorage(STORAGE_KEYS.user, { ...baseUser, mode });
    await saveAuthTokens('access-token', 'refresh-token');
  }

  async function mountAuth() {
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return hook;
  }

  test('returns not-authenticated when no user is logged in', async () => {
    const { result } = await mountAuth();

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('driver');
    });

    expect(outcome).toEqual({ ok: false, reason: 'not-authenticated' });
    expect(queueRoleSync).not.toHaveBeenCalled();
  });

  test('refuses driver mode for an unverified profile — no silent bail', async () => {
    await seedAuthedUser('customer');
    const { result } = await mountAuth();

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('driver');
    });

    expect(outcome).toEqual({ ok: false, reason: 'not-verified' });
    expect(result.current.user?.mode).toBe('customer');
    expect(queueRoleSync).not.toHaveBeenCalled();
  });

  test('switching to the current mode is an idempotent success', async () => {
    await seedAuthedUser('customer');
    const { result } = await mountAuth();

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('customer');
    });

    expect(outcome).toEqual({ ok: true, mode: 'customer', changed: false });
    expect(queueRoleSync).not.toHaveBeenCalled();
  });

  test('switches to driver instantly and queues the backend sync', async () => {
    await seedAuthedUser('customer');
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.saveDriverProfile(baseProfile);
    });

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('driver');
    });

    expect(outcome).toEqual({ ok: true, mode: 'driver', changed: true });
    expect(result.current.user?.mode).toBe('driver');
    expect(queueRoleSync).toHaveBeenCalledWith({ mode: 'driver', driverOffline: false });
  });

  test('leaving driver mode forces the driver offline locally and in the sync', async () => {
    await seedAuthedUser('driver');
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.saveDriverProfile({
        ...baseProfile,
        isOnline: true,
        onlineVehicleSession: {
          vehicleId: 'primary',
          vehicleType: 'moto',
          startedAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('customer');
    });

    expect(outcome).toEqual({ ok: true, mode: 'customer', changed: true });
    expect(result.current.user?.mode).toBe('customer');
    expect(result.current.driverProfile?.isOnline).toBe(false);
    expect(result.current.driverProfile?.onlineVehicleSession).toBeNull();
    expect(queueRoleSync).toHaveBeenCalledWith({ mode: 'customer', driverOffline: true });
  });

  test('an active ride blocks the switch in both directions', async () => {
    await seedAuthedUser('driver');
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.saveDriverProfile(baseProfile);
    });
    setRideActivity('confirmed', false);

    let outcome: RoleSwitchResult | undefined;
    await act(async () => {
      outcome = await result.current.switchMode('customer');
    });

    expect(outcome).toEqual({ ok: false, reason: 'active-ride' });
    expect(result.current.user?.mode).toBe('driver');
    expect(queueRoleSync).not.toHaveBeenCalled();
  });
});
