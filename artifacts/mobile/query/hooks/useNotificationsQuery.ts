import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { notificationRepository, listNotifications, getUnreadNotificationCount } from '@/domains/notifications/repository';
import {
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
} from '@/services/notifications';
import { notificationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';
import type { NotificationFeedContext, NotificationItem } from '@/domains/notifications';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';

function useNotificationFeedContext(): NotificationFeedContext {
  const { user } = useAuth();
  const { currentRide, pendingRequest, rideHistory } = useRide();
  const { entitlement, isLoading, rideCredits } = useDriverEntitlement();

  return useMemo(() => ({
    currentRide: currentRide ?? null,
    pendingRequest: pendingRequest ?? null,
    rideHistory,
    driverId: user?.id,
    driverMode: user?.mode === 'driver',
    entitlement: entitlement ?? EMPTY_DRIVER_ENTITLEMENT,
    rideCredits: isLoading ? Number.POSITIVE_INFINITY : rideCredits,
  }), [currentRide, entitlement, isLoading, pendingRequest, rideCredits, rideHistory, user?.id, user?.mode]);
}

function useNotificationFeedInvalidation(signature: string, userId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId ?? 'anonymous') });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId ?? 'anonymous') });
  }, [queryClient, signature, userId]);
}

function useFeedSignature(feedContext: NotificationFeedContext) {
  return useMemo(() => JSON.stringify({
    currentRideId: feedContext.currentRide?.id ?? null,
    currentRideStatus: feedContext.currentRide?.status ?? null,
    pendingRequestId: feedContext.pendingRequest?.id ?? null,
    rideHistory: feedContext.rideHistory.map(ride => [ride.id, ride.status, ride.completedAt ?? null]),
    driverMode: feedContext.driverMode,
    driverId: feedContext.driverId ?? null,
    entitlementUpdatedAt: feedContext.entitlement.updatedAt,
    rideCredits: feedContext.rideCredits,
  }), [feedContext]);
}

export function useNotificationsQuery() {
  const { user } = useAuth();
  const feedContext = useNotificationFeedContext();
  const signature = useFeedSignature(feedContext);
  useNotificationFeedInvalidation(signature, user?.id);

  return usePolicyQuery(queryPolicies.notifications, {
    queryKey: notificationKeys.list(user?.id ?? 'anonymous'),
    queryFn: async () => listNotifications(feedContext),
  });
}

export function useUnreadNotificationCountQuery() {
  const { user } = useAuth();
  const feedContext = useNotificationFeedContext();
  const signature = useFeedSignature(feedContext);
  useNotificationFeedInvalidation(signature, user?.id);

  return usePolicyQuery(queryPolicies.notifications, {
    queryKey: notificationKeys.unreadCount(user?.id ?? 'anonymous'),
    queryFn: async () => getUnreadNotificationCount(feedContext),
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
  const feedContext = useNotificationFeedContext();

  return useMutation({
    mutationFn: async () => {
      const allNotifications = await listNotifications(feedContext);
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
