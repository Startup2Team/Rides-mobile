import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { usePushNotifications } from '../usePushNotifications';

const mockTriggerRideReconcile = jest.fn();

jest.mock('@/state/rideReconcileTrigger', () => ({
  triggerRideReconcile: (...args: unknown[]) => mockTriggerRideReconcile(...args),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

function notificationWithData(data: Record<string, unknown>) {
  return { request: { content: { data } } } as unknown as Notifications.Notification;
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client }, children)
  );
}

function renderPushNotifications() {
  return renderHook(() => usePushNotifications(), { wrapper: createWrapper() });
}

function lastReceivedListener() {
  const calls = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as (notification: Notifications.Notification) => void;
}

describe('usePushNotifications — ride reconcile self-heal', () => {
  beforeEach(() => {
    mockTriggerRideReconcile.mockClear();
    (Notifications.addNotificationReceivedListener as jest.Mock).mockClear();
  });

  test('a foreground ride_cancelled push triggers ride reconciliation', () => {
    renderPushNotifications();
    const listener = lastReceivedListener();

    listener(notificationWithData({ type: 'ride_cancelled' }));

    expect(mockTriggerRideReconcile).toHaveBeenCalledTimes(1);
  });

  test('a foreground ride_taken push triggers ride reconciliation', () => {
    renderPushNotifications();
    const listener = lastReceivedListener();

    listener(notificationWithData({ type: 'ride_taken' }));

    expect(mockTriggerRideReconcile).toHaveBeenCalledTimes(1);
  });

  test('unrelated push types do not trigger ride reconciliation', () => {
    renderPushNotifications();
    const listener = lastReceivedListener();

    listener(notificationWithData({ type: 'driver_matched' }));
    listener(notificationWithData({}));

    expect(mockTriggerRideReconcile).not.toHaveBeenCalled();
  });
});
