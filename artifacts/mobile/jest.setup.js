globalThis.__DEV__ = true;

globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame ?? (handle => clearTimeout(handle));

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
    __clear: () => {
      storage.clear();
      globalThis.__RIDES_CLEAR_DRIVER_ENTITLEMENT_CACHE__?.();
    },
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: (props: any) => React.createElement(View, props),
  };
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));
