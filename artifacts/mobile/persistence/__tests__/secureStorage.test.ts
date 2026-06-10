import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import {
  loadSecureStorage,
  getSecureStorageKey,
  saveSecureStorage,
} from '../secureStorage';
import { serializeVersionedStorage } from '../versionedStorage';

const TEST_KEY = '@rides_sensitive_test';
const schema = z.object({ id: z.string() });
const value = { id: 'private-value' };

describe('secure storage migration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.restoreAllMocks();
  });

  test('migrates a legacy AsyncStorage value and removes the insecure copy', async () => {
    await AsyncStorage.setItem(TEST_KEY, JSON.stringify(value));

    await expect(loadSecureStorage(TEST_KEY, schema)).resolves.toEqual({
      data: value,
      source: 'legacy',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBeNull();
    await expect(SecureStore.getItemAsync(getSecureStorageKey(TEST_KEY))).resolves.toBe(
      serializeVersionedStorage(value),
    );
  });

  test('keeps the legacy value when the secure migration write fails', async () => {
    await AsyncStorage.setItem(TEST_KEY, JSON.stringify(value));
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('secure write failed'));

    await expect(loadSecureStorage(TEST_KEY, schema)).rejects.toThrow('secure write failed');
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBe(serializeVersionedStorage(value));
  });

  test('removes invalid sensitive legacy data from AsyncStorage', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await AsyncStorage.setItem(TEST_KEY, '{broken');

    await expect(loadSecureStorage(TEST_KEY, schema)).resolves.toEqual({
      data: null,
      source: 'invalid',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBeNull();
  });

  test('round-trips large sensitive values through secure chunks', async () => {
    const largeSchema = z.object({ value: z.string() });
    const largeValue = { value: 'private'.repeat(1_000) };

    await saveSecureStorage(TEST_KEY, largeValue);

    await expect(loadSecureStorage(TEST_KEY, largeSchema)).resolves.toEqual({
      data: largeValue,
      source: 'current',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBeNull();
  });

  test('keeps sensitive data memory-only when SecureStore is unavailable', async () => {
    jest.spyOn(SecureStore, 'isAvailableAsync').mockResolvedValue(false);

    await saveSecureStorage(TEST_KEY, value);

    await expect(loadSecureStorage(TEST_KEY, schema)).resolves.toEqual({
      data: value,
      source: 'current',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBeNull();
  });
});
