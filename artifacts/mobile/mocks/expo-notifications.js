// Jest stub for expo-notifications: the real package ships untransformed ESM
// that jest can't parse, which broke every suite whose import graph reached
// services/pushRegistration.ts (i.e. anything mounting the real AuthContext).
// Test files that jest.mock('expo-notifications', ...) still take precedence.
const subscription = () => ({ remove: jest.fn() });

module.exports = {
  __esModule: true,
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false, canAskAgain: false })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: 'ios', data: 'test-push-token' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationReceivedListener: jest.fn(subscription),
  addNotificationResponseReceivedListener: jest.fn(subscription),
};
