import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import {
  loadVersionedStorage,
  saveVersionedStorage,
  STORAGE_VERSION,
} from '../versionedStorage';

const TEST_KEY = '@test_versioned_storage';
const schema = z.object({ id: z.string(), count: z.number() });
const value = { id: 'valid', count: 2 };

describe('versioned storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  test('loads a valid current envelope', async () => {
    await saveVersionedStorage(TEST_KEY, value);

    await expect(loadVersionedStorage(TEST_KEY, schema)).resolves.toEqual({
      data: value,
      source: 'current',
    });
  });

  test('loads and migrates a valid legacy value', async () => {
    await AsyncStorage.setItem(TEST_KEY, JSON.stringify(value));

    await expect(loadVersionedStorage(TEST_KEY, schema)).resolves.toEqual({
      data: value,
      source: 'legacy',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBe(
      JSON.stringify({ version: STORAGE_VERSION, data: value }),
    );
  });

  test('returns a safe fallback for corrupted JSON and logs a structured warning', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await AsyncStorage.setItem(TEST_KEY, '{broken');

    await expect(loadVersionedStorage(TEST_KEY, schema)).resolves.toEqual({
      data: null,
      source: 'invalid',
    });
    expect(warning).toHaveBeenCalledWith(
      '[storage-validation]',
      expect.objectContaining({ key: TEST_KEY, reason: 'corrupted-json' }),
    );
  });

  test('returns a safe fallback for an invalid shape without deleting it', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invalidRaw = JSON.stringify({ id: 123, count: 'wrong' });
    await AsyncStorage.setItem(TEST_KEY, invalidRaw);

    await expect(loadVersionedStorage(TEST_KEY, schema)).resolves.toEqual({
      data: null,
      source: 'invalid',
    });
    await expect(AsyncStorage.getItem(TEST_KEY)).resolves.toBe(invalidRaw);
    expect(warning).toHaveBeenCalledWith(
      '[storage-validation]',
      expect.objectContaining({ key: TEST_KEY, reason: 'invalid-legacy-shape' }),
    );
  });
});
