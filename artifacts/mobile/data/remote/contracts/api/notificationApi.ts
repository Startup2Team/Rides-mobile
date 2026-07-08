import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  category?: 'ride' | 'promo' | 'system' | 'safety' | null;
  rideId?: string | null;
}

export interface ListNotificationsResponseDto extends ApiEnvelope<{ items: NotificationDto[] } & ApiPaginationResponse> {}

export interface ListNotificationsRequestDto extends ApiPaginationRequest {}

export interface UnreadNotificationCountResponseDto extends ApiEnvelope<{ count: number }> {}

export interface MarkNotificationReadRequestDto extends ApiIdempotencyMetadata {
  notificationId: string;
}

export interface MarkNotificationReadResponseDto extends ApiEnvelope<{ notificationId: string; readAt: string | null; unreadCount: number }> {}

export interface MarkNotificationUnreadRequestDto extends ApiIdempotencyMetadata {
  notificationId: string;
}

export interface MarkNotificationUnreadResponseDto extends ApiEnvelope<{ notificationId: string; readAt: string | null; unreadCount: number }> {}

export interface MarkAllNotificationsReadRequestDto extends ApiIdempotencyMetadata {}

export interface MarkAllNotificationsReadResponseDto extends ApiEnvelope<{ updatedCount: number; unreadCount: number }> {}

export interface ClearNotificationsRequestDto extends ApiIdempotencyMetadata {}

export interface ClearNotificationsResponseDto extends ApiEnvelope<{ clearedCount: number }> {}

export interface NotificationErrorDto extends ApiErrorDto {}

export interface NotificationApiContract {
  listNotifications: ApiPaginationRequest | undefined;
  unreadCount: undefined;
  markNotificationRead: MarkNotificationReadRequestDto;
  markNotificationUnread: MarkNotificationUnreadRequestDto;
  markAllNotificationsRead: MarkAllNotificationsReadRequestDto;
  clearNotifications: ClearNotificationsRequestDto;
}
