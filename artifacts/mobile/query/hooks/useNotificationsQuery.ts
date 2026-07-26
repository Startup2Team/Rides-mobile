import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { notificationRepository, listNotifications, getUnreadNotificationCount } from '@/domains/notifications/repository';
import {
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
  markNotificationUnread as apiMarkNotificationUnread,
  deleteNotification as apiDeleteNotification,
} from '@/services/notifications';
import { notificationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';
import type { NotificationItem } from '@/domains/notifications';

// The notifications feed is sourced entirely from the backend, so the query no
// longer needs a ride/driver-derived feed context or manual invalidation on
// local ride-state changes; React Query's staleTime + refetch drives freshness.

export function useNotificationsQuery() {
  const { user } = useAuth();

  return usePolicyQuery(queryPolicies.notifications, {
    queryKey: notificationKeys.list(user?.id ?? 'anonymous'),
    queryFn: async () => listNotifications(),
  });
}

export function useUnreadNotificationCountQuery() {
  const { user } = useAuth();

  return usePolicyQuery(queryPolicies.notifications, {
    queryKey: notificationKeys.unreadCount(user?.id ?? 'anonymous'),
    queryFn: async () => getUnreadNotificationCount(),
  });
}

function updateNotificationList(cache: NotificationItem[] | undefined, updater: (item: NotificationItem) => NotificationItem) {
  return cache?.map(updater) ?? [];
}

function toReadState(notifications: NotificationItem[]) {
  return {
    read: new Set(notifications.filter(notification => notification.read).map(notification => notification.id)),
    unread: new Set(notifications.filter(notification => !notification.read).map(notification => notification.id)),
  };
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await notificationRepository.markRead(notificationId);
      // Backend push records own their read-state on the server; sync it.
      // Locally-derived items have no server row, so skip them.
      const cached = queryClient.getQueryData<NotificationItem[]>(notificationKeys.list(userId)) ?? [];
      if (cached.find(item => item.id === notificationId)?.source === 'backend') {
        try {
          await apiMarkNotificationRead(notificationId);
        } catch {
          // Offline / unreachable — local overlay keeps the optimistic state.
        }
      }
      return notificationId;
    },
    onMutate: async notificationId => {
      const key = notificationKeys.list(userId);
      const previous = queryClient.getQueryData<NotificationItem[]>(key) ?? [];
      queryClient.setQueryData(key, updateNotificationList(previous, item =>
        item.id === notificationId ? { ...item, read: true } : item,
      ));
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (!context) return;
      queryClient.setQueryData(notificationKeys.list(userId), context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}

export function useMarkNotificationUnreadMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await notificationRepository.markUnread(notificationId);
      // Sync to the server for backend-sourced items (locally-derived items
      // have no server row, so skip them).
      const cached = queryClient.getQueryData<NotificationItem[]>(notificationKeys.list(userId)) ?? [];
      if (cached.find(item => item.id === notificationId)?.source === 'backend') {
        try {
          await apiMarkNotificationUnread(notificationId);
        } catch {
          // Offline / unreachable — local overlay keeps the optimistic state.
        }
      }
      return notificationId;
    },
    onMutate: async notificationId => {
      const key = notificationKeys.list(userId);
      const previous = queryClient.getQueryData<NotificationItem[]>(key) ?? [];
      queryClient.setQueryData(key, updateNotificationList(previous, item =>
        item.id === notificationId ? { ...item, read: false } : item,
      ));
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (!context) return;
      queryClient.setQueryData(notificationKeys.list(userId), context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useMutation({
    mutationFn: async () => {
      const allNotifications = await listNotifications();
      await notificationRepository.saveReadState(toReadState(allNotifications));
      // Mark the server-side feed read too (no-op if there are none).
      if (allNotifications.some(item => item.source === 'backend')) {
        try {
          await apiMarkAllNotificationsRead();
        } catch {
          // Offline / unreachable — local overlay keeps the optimistic state.
        }
      }
    },
    onMutate: async () => {
      const key = notificationKeys.list(userId);
      const previous = queryClient.getQueryData<NotificationItem[]>(key) ?? [];
      queryClient.setQueryData(key, previous.map(item => ({ ...item, read: true })));
      return { previous };
    },
    onError: (_error, _unused, context) => {
      if (!context) return;
      queryClient.setQueryData(notificationKeys.list(userId), context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const cached = queryClient.getQueryData<NotificationItem[]>(notificationKeys.list(userId)) ?? [];
      // Backend-sourced items are soft-deleted server-side (DELETE …/{id} →
      // deleted_at); they stay recoverable and won't return in the feed. Local-
      // derived items have no server row — the optimistic cache removal suffices.
      if (cached.find(item => item.id === notificationId)?.source === 'backend') {
        try {
          await apiDeleteNotification(notificationId);
        } catch {
          // Offline / unreachable — optimistic removal holds until next refetch.
        }
      }
      return notificationId;
    },
    onMutate: async notificationId => {
      const key = notificationKeys.list(userId);
      const previous = queryClient.getQueryData<NotificationItem[]>(key) ?? [];
      queryClient.setQueryData(key, previous.filter(item => item.id !== notificationId));
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (!context) return;
      queryClient.setQueryData(notificationKeys.list(userId), context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}

export function useClearNotificationsMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useMutation({
    mutationFn: async () => {
      await notificationRepository.clear();
    },
    onMutate: async () => {
      const key = notificationKeys.list(userId);
      const previous = queryClient.getQueryData<NotificationItem[]>(key) ?? [];
      queryClient.setQueryData(key, [] as NotificationItem[]);
      return { previous };
    },
    onError: (_error, _unused, context) => {
      if (!context) return;
      queryClient.setQueryData(notificationKeys.list(userId), context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}
