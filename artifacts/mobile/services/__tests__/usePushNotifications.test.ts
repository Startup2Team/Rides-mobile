import { renderHook } from '@testing-library/react-native';
import { usePushNotifications } from '../usePushNotifications';
import { registerRideReconcileHandler } from '@/state/rideReconcileTrigger';

type Listener = (arg: unknown) => void;

let receivedListener: Listener | null = null;
let responseListener: Listener | null = null;

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: (cb: Listener) => {
    receivedListener = cb;
    return { remove: jest.fn() };
  },
  addNotificationResponseReceivedListener: (cb: Listener) => {
    responseListener = cb;
    return { remove: jest.fn() };
  },
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

describe('usePushNotifications reconcile wiring', () => {
  beforeEach(() => {
    receivedListener = null;
    responseListener = null;
    registerRideReconcileHandler(null);
  });

  afterEach(() => {
    registerRideReconcileHandler(null);
  });

  test('a foreground push implying the ride may have moved on triggers reconcile', () => {
    const reconcile = jest.fn();
    registerRideReconcileHandler(reconcile);
    renderHook(() => usePushNotifications());

    receivedListener!({ request: { content: { data: { type: 'ride_cancelled' } } } });

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  test('a foreground push of an unrelated type does not trigger reconcile', () => {
    const reconcile = jest.fn();
    registerRideReconcileHandler(reconcile);
    renderHook(() => usePushNotifications());

    receivedListener!({ request: { content: { data: { type: 'negotiation_message' } } } });

    expect(reconcile).not.toHaveBeenCalled();
  });

  test('tapping a reconcile-worthy push also triggers reconcile', () => {
    const reconcile = jest.fn();
    registerRideReconcileHandler(reconcile);
    renderHook(() => usePushNotifications());

    responseListener!({ notification: { request: { content: { data: { type: 'driver_arrived' } } } } });

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  test('is a safe no-op when no ride is loaded (no handler registered)', () => {
    renderHook(() => usePushNotifications());

    expect(() =>
      receivedListener!({ request: { content: { data: { type: 'ride_completed' } } } }),
    ).not.toThrow();
  });
});
