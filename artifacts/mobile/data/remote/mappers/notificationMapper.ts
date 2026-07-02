import { BackendError, BackendUnavailableError, ConflictError, ForbiddenError, OfflineError, RateLimitedError, SerializationError, ServerError, TimeoutError, UnauthorizedError, ValidationError, createNotImplementedError } from '../contracts/backendErrors';
import type {
  ClearNotificationsRequestDto,
  ClearNotificationsResponseDto,
  ListNotificationsResponseDto,
  MarkAllNotificationsReadRequestDto,
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadRequestDto,
  MarkNotificationReadResponseDto,
  MarkNotificationUnreadRequestDto,
  MarkNotificationUnreadResponseDto,
  NotificationDto,
  UnreadNotificationCountResponseDto,
} from '../contracts/api';
import type { NotificationItem, NotificationReadState } from '@/domains/notifications';

const CATEGORY_PRIORITY: Record<NonNullable<NotificationDto['category']>, NotificationItem['type']> = {
  ride: 'ride',
  promo: 'promo',
  system: 'system',
  safety: 'safety',
};

const ICON_BY_CATEGORY: Record<NotificationItem['type'], NotificationItem['icon']> = {
  ride: 'check-circle',
  promo: 'gift',
  system: 'clock',
  safety: 'shield',
};

function normalizeCategory(dto: NotificationDto): NotificationItem['type'] {
  if (dto.category && CATEGORY_PRIORITY[dto.category]) {
    return CATEGORY_PRIORITY[dto.category];
  }

  const haystack = `${dto.title} ${dto.body} ${dto.rideId ?? ''}`.toLowerCase();
  if (haystack.includes('safety')) return 'safety';
  if (haystack.includes('promo') || haystack.includes('discount') || haystack.includes('offer')) return 'promo';
  if (haystack.includes('ride') || haystack.includes('trip') || haystack.includes('driver')) return 'ride';
  return 'system';
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function normalizeNotification(dto: NotificationDto): NotificationItem {
  const type = normalizeCategory(dto);
  return {
    id: dto.id,
    type,
    icon: ICON_BY_CATEGORY[type],
    title: dto.title,
    message: dto.body,
    time: dto.createdAt,
    read: Boolean(dto.readAt),
    rideId: dto.rideId ?? undefined,
  };
}

export function dtoToDomainNotification(dto: NotificationDto): NotificationItem {
  return normalizeNotification(dto);
}

export function dtoListToDomainNotifications(dto: ListNotificationsResponseDto['data']): NotificationItem[] {
  return (dto.items ?? [])
    .map(normalizeNotification)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export function dtoUnreadCountToNumber(dto: UnreadNotificationCountResponseDto['data']): number {
  return dto.count;
}

export function notificationReadStateToDto(state: NotificationReadState): {
  read: string[];
  unread: string[];
} {
  return {
    read: [...state.read],
    unread: [...state.unread],
  };
}

export function domainToMarkNotificationReadDto(
  notificationId: string,
  metadata: MarkNotificationReadRequestDto,
): MarkNotificationReadRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    notificationId,
  };
}

export function domainToMarkNotificationUnreadDto(
  notificationId: string,
  metadata: MarkNotificationUnreadRequestDto,
): MarkNotificationUnreadRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    notificationId,
  };
}

export function domainToMarkAllNotificationsReadDto(
  metadata: MarkAllNotificationsReadRequestDto,
): MarkAllNotificationsReadRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
  };
}

export function domainToClearNotificationsDto(
  metadata: ClearNotificationsRequestDto,
): ClearNotificationsRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
  };
}

export function responseToUnreadCount(value: UnreadNotificationCountResponseDto | ClearNotificationsResponseDto | MarkAllNotificationsReadResponseDto | MarkNotificationReadResponseDto | MarkNotificationUnreadResponseDto): number {
  if ('count' in value.data) return value.data.count;
  if ('unreadCount' in value.data) return value.data.unreadCount;
  if ('clearedCount' in value.data) return 0;
  return 0;
}

export function errorToRepositoryFailureNotification(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'notification', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('notification', 'errorToRepositoryFailure', 'mapper');
}

export function summarizeNotificationShape(value: unknown) {
  return summarizeShape(value);
}
