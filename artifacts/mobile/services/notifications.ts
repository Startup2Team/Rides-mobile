import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real backend notifications under /api/v1/users/me/notifications.

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, string>;
  isRead: boolean;
  sentAt: string;
  readAt: string | null;
}

interface NotificationDto {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
  is_read: boolean;
  sent_at: string;
  read_at?: string | null;
}

interface Envelope<T> {
  data: T;
}

function toDomain(dto: NotificationDto): AppNotification {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    type: dto.type,
    data: dto.data ?? {},
    isRead: dto.is_read,
    sentAt: dto.sent_at,
    readAt: dto.read_at ?? null,
  };
}

// The backend wraps the feed in an object: { data: { notifications: [...]|null,
// unread_count } }. Older builds returned a bare array; accept both so a
// contract tweak can't crash the feed.
interface NotificationListDto {
  notifications?: NotificationDto[] | null;
  unread_count?: number;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const response = await getAppBackendClient().get<Envelope<NotificationListDto | NotificationDto[] | null>>(
    '/v1/users/me/notifications',
  );
  const payload = response.data.data;
  const list = Array.isArray(payload) ? payload : payload?.notifications ?? [];
  return list.map(toDomain);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await getAppBackendClient().get<Envelope<{ count?: number; unread_count?: number }>>(
    '/v1/users/me/notifications/unread-count',
  );
  const data = response.data.data;
  return data.count ?? data.unread_count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await getAppBackendClient().patch(`/v1/users/me/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await getAppBackendClient().post('/v1/users/me/notifications/mark-all-read', {});
}
