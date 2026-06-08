import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import { loadStoredDriverProfile } from '@/persistence/authPersistence';
import { getSecureStorageKey, saveSecureStorage } from '@/persistence/secureStorage';
import { AuthProvider, useAuth } from '../AuthContext';
import type { DriverProfile } from '@/types';

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

    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: true }),
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

  test('does nothing if no driverProfile is set', async () => {
    const hook = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    await act(async () => {
      await hook.result.current.recordCompletedRide(2000);
    });

    expect(hook.result.current.driverProfile).toBeNull();
  });
});
