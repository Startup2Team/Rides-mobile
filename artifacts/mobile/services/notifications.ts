import { api } from './api';

export interface BackendNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
  is_read: boolean;
  sent_at: string;
  read_at?: string;
}

export interface NotificationsResponse {
  notifications: BackendNotification[] | null;
  unread_count: number;
}

export async function getNotifications(limit = 30, offset = 0): Promise<NotificationsResponse> {
  const { data } = await api.get(`/users/me/notifications?limit=${limit}&offset=${offset}`);
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/users/me/notifications/unread-count');
  return data?.unread_count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/users/me/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/users/me/notifications/mark-all-read');
}
