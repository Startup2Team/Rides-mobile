import { useMemo } from 'react';
import {
  useClearNotificationsMutation,
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMarkNotificationUnreadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from '@/query/hooks/useNotificationsQuery';
import type { NotificationItem } from './types';

export type NotificationDayBucket = 'today' | 'yesterday' | 'previous';

export interface NotificationSections {
  today: NotificationItem[];
  yesterday: NotificationItem[];
  previous: NotificationItem[];
}

export function getNotificationDayBucket(time: string): NotificationDayBucket {
  const notificationDate = new Date(time);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfNotificationDay = new Date(
    notificationDate.getFullYear(),
    notificationDate.getMonth(),
    notificationDate.getDate(),
  ).getTime();
  const diffDays = Math.floor((startOfToday - startOfNotificationDay) / 86400000);

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'previous';
}

export function groupNotificationsByDay(notifications: NotificationItem[]): NotificationSections {
  return notifications.reduce<NotificationSections>((acc, item) => {
    const bucket = getNotificationDayBucket(item.time);
    acc[bucket].push(item);
    return acc;
  }, { today: [], yesterday: [], previous: [] });
}

export function useNotifications() {
  const notificationsQuery = useNotificationsQuery();
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const markRead = useMarkNotificationReadMutation();
  const markUnread = useMarkNotificationUnreadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();
  const deleteNotification = useDeleteNotificationMutation();
  const clearNotifications = useClearNotificationsMutation();

  const notifications = notificationsQuery.data ?? [];
  const sections = useMemo(() => groupNotificationsByDay(notifications), [notifications]);

  return {
    notifications,
    unreadCount: unreadCountQuery.data ?? notifications.filter(item => !item.read).length,
    sections,
    isLoading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
    isRefreshing: notificationsQuery.isFetching || unreadCountQuery.isFetching,
    refreshNotifications: notificationsQuery.refetch,
    markNotificationRead: markRead.mutateAsync,
    markNotificationUnread: markUnread.mutateAsync,
    markAllNotificationsRead: markAllRead.mutateAsync,
    deleteNotification: deleteNotification.mutateAsync,
    clearNotifications: clearNotifications.mutateAsync,
  };
}
