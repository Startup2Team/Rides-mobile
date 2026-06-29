import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { NotificationItem } from '@/domains/notifications';
import { notificationKeys } from '../keys';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMarkNotificationUnreadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from '../hooks/useNotificationsQuery';

const mockListNotifications = jest.fn();
const mockGetUnreadNotificationCount = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkUnread = jest.fn();
const mockSaveReadState = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', mode: 'customer' } }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    currentRide: null,
    pendingRequest: null,
    rideHistory: [],
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: { updatedAt: '2026-06-28T00:00:00.000Z', purchaseHistory: [] },
    isLoading: false,
    rideCredits: 20,
  }),
  EMPTY_DRIVER_ENTITLEMENT: { updatedAt: '2026-06-28T00:00:00.000Z', purchaseHistory: [] },
}));

jest.mock('@/domains/notifications/repository', () => ({
  notificationRepository: {
    getReadState: jest.fn(),
    saveReadState: (...args: unknown[]) => mockSaveReadState(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markUnread: (...args: unknown[]) => mockMarkUnread(...args),
    clear: jest.fn(),
  },
  listNotifications: (...args: unknown[]) => mockListNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) => mockGetUnreadNotificationCount(...args),
  getNotificationAccentColor: jest.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

const notifications: NotificationItem[] = [
  { id: 'n-1', type: 'ride', icon: 'check-circle', title: 'Ride completed', message: 'Done', time: '2026-06-28T10:00:00.000Z', read: false, rideId: 'ride-1' },
  { id: 'n-2', type: 'system', icon: 'clock', title: 'System update', message: 'Updated', time: '2026-06-27T10:00:00.000Z', read: true },
];

describe('notifications query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListNotifications.mockResolvedValue(notifications);
    mockGetUnreadNotificationCount.mockResolvedValue(1);
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkUnread.mockResolvedValue(undefined);
    mockSaveReadState.mockResolvedValue(undefined);
  });

  test('loads notifications and unread count through the repository layer', async () => {
    const { client, wrapper } = createWrapper();

    const listHook = renderHook(() => useNotificationsQuery(), { wrapper });
    const unreadHook = renderHook(() => useUnreadNotificationCountQuery(), { wrapper });

    await waitFor(() => expect(listHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(unreadHook.result.current.isFetched).toBe(true));

    expect(listHook.result.current.data).toEqual(notifications);
    expect(unreadHook.result.current.data).toBe(1);
    expect(mockListNotifications).toHaveBeenCalled();
    expect(mockGetUnreadNotificationCount).toHaveBeenCalled();
    expect(client.getQueryData(notificationKeys.list('user-1'))).toEqual(notifications);
    expect(client.getQueryData(notificationKeys.unreadCount('user-1'))).toBe(1);
  });

  test('mark read and unread mutations update the cache optimistically and roll back on failure', async () => {
    const { client, wrapper } = createWrapper();
    client.setQueryData(notificationKeys.list('user-1'), notifications);

    const readHook = renderHook(() => useMarkNotificationReadMutation(), { wrapper });
    await act(async () => {
      await readHook.result.current.mutateAsync('n-1');
    });
    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.[0].read).toBe(true);
    expect(mockMarkRead).toHaveBeenCalledWith('n-1');

    client.setQueryData(notificationKeys.list('user-1'), notifications);
    mockMarkRead.mockRejectedValueOnce(new Error('read failed'));
    await expect(readHook.result.current.mutateAsync('n-1')).rejects.toThrow('read failed');
    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.[0].read).toBe(false);

    const unreadHook = renderHook(() => useMarkNotificationUnreadMutation(), { wrapper });
    client.setQueryData(notificationKeys.list('user-1'), notifications.map(item => item.id === 'n-1' ? { ...item, read: true } : item));
    await act(async () => {
      await unreadHook.result.current.mutateAsync('n-1');
    });
    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.[0].read).toBe(false);

    mockMarkUnread.mockRejectedValueOnce(new Error('rollback'));
    client.setQueryData(notificationKeys.list('user-1'), notifications.map(item => item.id === 'n-1' ? { ...item, read: true } : item));
    await expect(unreadHook.result.current.mutateAsync('n-1')).rejects.toThrow('rollback');
    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.[0].read).toBe(true);
  });

  test('mark all read updates the cache optimistically and rolls back on failure', async () => {
    const { client, wrapper } = createWrapper();
    client.setQueryData(notificationKeys.list('user-1'), notifications);
    mockListNotifications.mockResolvedValue(notifications);

    const hook = renderHook(() => useMarkAllNotificationsReadMutation(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync();
    });

    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.every(item => item.read)).toBe(true);

    client.setQueryData(notificationKeys.list('user-1'), notifications);
    mockSaveReadState.mockRejectedValueOnce(new Error('save failed'));
    await expect(hook.result.current.mutateAsync()).rejects.toThrow('save failed');
    expect(client.getQueryData<NotificationItem[]>(notificationKeys.list('user-1'))?.[0].read).toBe(false);
  });
});
