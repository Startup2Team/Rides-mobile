import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}

export interface ListNotificationsResponseDto extends ApiEnvelope<{ items: NotificationDto[] } & ApiPaginationResponse> {}

export interface UnreadNotificationCountResponseDto extends ApiEnvelope<{ count: number }> {}

export interface MarkNotificationReadRequestDto extends ApiIdempotencyMetadata {
  notificationId: string;
}

export interface MarkAllNotificationsReadRequestDto extends ApiIdempotencyMetadata {}

export interface NotificationErrorDto extends ApiErrorDto {}

export interface NotificationApiContract {
  listNotifications: ApiPaginationRequest | undefined;
  unreadCount: undefined;
  markNotificationRead: MarkNotificationReadRequestDto;
  markAllNotificationsRead: MarkAllNotificationsReadRequestDto;
}
