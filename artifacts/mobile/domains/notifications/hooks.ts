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

/**
 * Whole calendar days between a notification's local day and today's.
 *
 * Calendar days, NOT elapsed hours: something sent at 23:00 last night is "1
 * day ago" at 01:00 even though only two hours passed, because that is how the
 * Today/Yesterday/Previous headings read it. The relative "Nd ago" label must
 * come from this same function — when it was computed independently as
 * floor(hours / 24), a notification from two calendar days back rendered as
 * "1d ago" while sitting under Previous, with Yesterday showing "No
 * notifications". That looked exactly like a loading failure.
 *
 * Returns NaN for an unparseable timestamp; callers treat that as 'previous'.
 */
export function notificationCalendarDaysAgo(time: string, now: Date = new Date()): number {
  const notificationDate = new Date(time);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfNotificationDay = new Date(
    notificationDate.getFullYear(),
    notificationDate.getMonth(),
    notificationDate.getDate(),
  ).getTime();
  // Round, not floor: both operands are local midnights, so the gap is a whole
  // number of days except across a DST shift, where floor would lose a day.
  return Math.round((startOfToday - startOfNotificationDay) / 86400000);
}

export function getNotificationDayBucket(time: string): NotificationDayBucket {
  const diffDays = notificationCalendarDaysAgo(time);
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
