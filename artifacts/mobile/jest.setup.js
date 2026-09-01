globalThis.__DEV__ = true;

globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame ?? (handle => clearTimeout(handle));

// AppState's real module reaches into native TurboModules that don't exist
// under node, and any component subscribing to it (e.g. RideProvider's
// active-ride resume) would crash every suite that mounts it. Suites that mock
// 'react-native' wholesale are unaffected.
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

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

// react-native-reanimated ships ESM-only entry points our transformIgnorePatterns
// doesn't cover, so any suite that transitively imports a component using it
// (e.g. map markers, HomeTopHeader) would fail to parse. Default mock keeps
// animated values synchronous/inert so suites that don't care about motion
// don't need their own copy of this. Suites that DO want to assert on the
// animation itself (see HomeTopHeader.test.tsx, useMarkerAppear.test.ts)
// declare their own more specific `jest.mock('react-native-reanimated', ...)`,
// which takes precedence over this one for that file.
jest.mock('react-native-reanimated', () => {
  const { View, Text, Image, ScrollView } = require('react-native');
  const identity = value => value;
  const withImmediate = (toValue, _config, callback) => {
    callback?.(true);
    return toValue;
  };

  return {
    __esModule: true,
    default: { View, Text, Image, ScrollView },
    Easing: {
      out: identity,
      in: identity,
      inOut: identity,
      linear: identity,
      ease: identity,
      quad: identity,
      cubic: identity,
    },
    useReducedMotion: () => false,
    useSharedValue: initial => ({ value: initial }),
    useAnimatedStyle: factory => factory(),
    useDerivedValue: factory => ({ value: factory() }),
    useAnimatedRef: () => ({ current: null }),
    withTiming: withImmediate,
    withSpring: withImmediate,
    withDelay: (_delay, animation) => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    runOnJS: fn => fn,
    runOnUI: fn => fn,
    cancelAnimation: () => {},
    interpolate: value => value,
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  };
});

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
  // Background-location APIs (customer live-location background streaming) —
  // default to "denied, can't ask again" so a suite that doesn't care about
  // this feature gets the graceful-degradation path, not a real OS prompt.
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'denied', canAskAgain: false })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'denied', canAskAgain: false })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
}));

// expo-task-manager's real module reaches into a native module
// (requireNativeModule('ExpoTaskManager')) that doesn't exist under node, and
// it's also published as ESM (no CommonJS build), which jest can't parse
// without transforming node_modules. defineTask itself is pure bookkeeping in
// the real module (just stores the callback in a Map) — this stub mirrors
// that so importing it for its module-load side effect never crashes a suite.
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
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
