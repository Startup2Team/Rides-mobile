import { notificationRepository as baseNotificationRepository } from '@/data/repositories';
import type {
  NotificationCategory,
  NotificationFeedContext,
  NotificationIconName,
  NotificationItem,
  NotificationReadState,
} from './types';
import { APPLE_SYSTEM_BLUE_HEX } from '@/constants/systemColors';
import { listNotifications as apiListNotifications, type AppNotification } from '@/services/notifications';

export const notificationRepository = baseNotificationRepository;

// Map a real backend notification (push record) onto the UI feed item shape.
function backendNotificationCategory(type: string): NotificationCategory {
  const t = type.toLowerCase();
  if (t.includes('ride') || t.includes('trip') || t.includes('driver')) return 'ride';
  if (t.includes('promo') || t.includes('campaign') || t.includes('package')) return 'promo';
  if (t.includes('safety') || t.includes('security') || t.includes('sos')) return 'safety';
  return 'system';
}

const CATEGORY_ICON: Record<NotificationCategory, NotificationIconName> = {
  ride: 'navigation',
  promo: 'package',
  safety: 'shield',
  system: 'bell',
};

function toNotificationItem(n: AppNotification): NotificationItem {
  const category = backendNotificationCategory(n.type);
  return {
    id: n.id,
    type: category,
    icon: CATEGORY_ICON[category],
    title: n.title,
    message: n.body,
    time: n.sentAt,
    read: n.isRead,
    rideId: n.data?.ride_id,
    source: 'backend',
  };
}

async function fetchBackendNotifications(): Promise<NotificationItem[]> {
  try {
    return (await apiListNotifications()).map(toNotificationItem);
  } catch {
    return [];
  }
}

export type { NotificationFeedContext, NotificationItem, NotificationReadState } from './types';

const TYPE_ICON_COLOR: Record<NotificationItem['type'], string> = {
  ride: APPLE_SYSTEM_BLUE_HEX.light,
  promo: '#FFB800',
  system: '#007AFF',
  safety: '#FF3B30',
};

// The feed is now sourced ONLY from the backend push-record store
// (GET /api/v1/users/me/notifications). No client-synthesized items are
// merged in. The local read-state overlay is preserved so optimistic /
// offline mark-read still reflects instantly on top of the server truth.
// `_context` is retained for signature compatibility with the repository
// interface and callers, but the feed no longer derives from local ride /
// driver state.
export async function listNotifications(_context?: NotificationFeedContext): Promise<NotificationItem[]> {
  const [state, backendNotifications] = await Promise.all([
    notificationRepository.getReadState(),
    fetchBackendNotifications(),
  ]);

  return backendNotifications
    .map(notification => {
      if (state.unread.has(notification.id)) return { ...notification, read: false };
      if (state.read.has(notification.id)) return { ...notification, read: true };
      return notification;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export async function getUnreadNotificationCount(_context?: NotificationFeedContext): Promise<number> {
  const notifications = await listNotifications();
  return notifications.filter(notification => !notification.read).length;
}

export function getNotificationAccentColor(type: NotificationItem['type']) {
  return TYPE_ICON_COLOR[type];
}

export { createRemoteNotificationRepositoryPrototype, createNotificationShadowRepository } from '@/data/remote/repositories/RemoteNotificationRepository';
