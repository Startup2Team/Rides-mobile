globalThis.__DEV__ = true;

jest.mock('@sentry/react-native', () => {
  const scope = {
    setTag: jest.fn(),
    setContext: jest.fn(),
  };

  return {
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    withScope: jest.fn(callback => callback(scope)),
    __scope: scope,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map();

  return {
    getItem: jest.fn(key => Promise.resolve(storage.get(key) ?? null)),
    setItem: jest.fn((key, value) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      storage.delete(key);
      return Promise.resolve();
    }),
    multiRemove: jest.fn(keys => {
      keys.forEach(key => storage.delete(key));
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      storage.clear();
      return Promise.resolve();
    }),
  };
});

jest.mock('expo-secure-store', () => {
  const storage = new Map();

  return {
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    getItemAsync: jest.fn(key => Promise.resolve(storage.get(key) ?? null)),
    setItemAsync: jest.fn((key, value) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn(key => {
      storage.delete(key);
      return Promise.resolve();
    }),
    __clear: () => storage.clear(),
  };
});
