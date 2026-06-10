import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SENSITIVE_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import { getSecureStorageKey, saveSecureStorage } from '@/persistence/secureStorage';
import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

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
