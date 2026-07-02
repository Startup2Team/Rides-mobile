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

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 1,
    High: 2,
  },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: -1.9441,
      longitude: 30.0619,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  })),
  reverseGeocodeAsync: jest.fn(async () => ([{
    city: 'Kigali',
    region: 'Kigali City',
    street: 'KN 4 Ave',
    name: 'Kigali',
  }])),
  watchPositionAsync: jest.fn(async (_options, callback) => {
    callback({
      coords: {
        latitude: -1.9441,
        longitude: 30.0619,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
    return { remove: jest.fn() };
  }),
}));

jest.mock('@/constants/savedLocations', () => ({
  SAVED_LOCATIONS_KEY: '@rides_saved_locations',
  SAVE_LOCATION_LABELS: ['Home', 'Work', 'School', 'Church', 'Market', 'Other'],
  SAVE_LABEL_WIDTHS: {
    Home: 48,
    Work: 48,
    School: 56,
    Church: 56,
    Market: 56,
    Other: 56,
  },
  MAX_SAVED_LOCATIONS: 20,
}));
