import type { NotificationRepository } from '@/data/repositories/interfaces';
import type { NotificationFeedContext, NotificationItem, NotificationReadState } from '@/domains/notifications';
import { observability } from '@/observability/context/observabilityContext';
import { getUnreadNotificationCount as getLocalUnreadNotificationCount, listNotifications as getLocalNotificationList } from '@/domains/notifications/repository';
import { BackendClient } from '../client/backendClient';
import { createBackendUnavailableError, BackendError } from '../contracts/backendErrors';
import type {
  ApiPaginationRequest,
  ClearNotificationsRequestDto,
  ClearNotificationsResponseDto,
  ListNotificationsResponseDto,
  MarkAllNotificationsReadRequestDto,
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadRequestDto,
  MarkNotificationReadResponseDto,
  MarkNotificationUnreadRequestDto,
  MarkNotificationUnreadResponseDto,
  UnreadNotificationCountResponseDto,
} from '../contracts/api';
import {
  domainToClearNotificationsDto,
  domainToMarkAllNotificationsReadDto,
  domainToMarkNotificationReadDto,
  domainToMarkNotificationUnreadDto,
  dtoListToDomainNotifications,
  dtoUnreadCountToNumber,
  errorToRepositoryFailureNotification,
  notificationReadStateToDto,
  responseToUnreadCount,
  summarizeNotificationShape,
} from '../mappers/notificationMapper';

export interface RemoteNotificationRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

function summarizeShape(value: unknown) {
  return summarizeNotificationShape(value);
}

function toBackendError(method: string, error: unknown): BackendError {
  void method;
  return errorToRepositoryFailureNotification(error);
}

function recordTelemetry(
  event: 'notifications remote shadow request' | 'notifications remote shadow success' | 'notifications remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('notifications.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('notifications.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('NotificationsRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function compareNotificationSemantics(local: NotificationItem[], remote: NotificationItem[]) {
  const normalize = (items: NotificationItem[]) => JSON.stringify(items.map(item => ({
    id: item.id,
    type: item.type,
    icon: item.icon,
    title: item.title,
    message: item.message,
    time: item.time,
    read: item.read,
    rideId: item.rideId ?? null,
  })));
  return normalize(local) !== normalize(remote);
}

function compareReadStateSemantics(local: NotificationReadState, remote: NotificationReadState) {
  const normalize = (state: NotificationReadState) => JSON.stringify({
    read: [...state.read].sort(),
    unread: [...state.unread].sort(),
  });
  return normalize(local) !== normalize(remote);
}

function toReadState(notifications: NotificationItem[]): NotificationReadState {
  return {
    read: new Set(notifications.filter(notification => notification.read).map(notification => notification.id)),
    unread: new Set(notifications.filter(notification => !notification.read).map(notification => notification.id)),
  };
}

export class RemoteNotificationRepository implements NotificationRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteNotificationRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('notifications remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('notifications remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('notifications remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toBackendError(method, error);
    }
  }

  async listNotifications(query: ApiPaginationRequest = {}): Promise<NotificationItem[]> {
    return this.shadow('listNotifications', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'listNotifications', 'remote');
      const response = await this.client.get<ListNotificationsResponseDto>('/v1/notifications', {
        query: query as Record<string, string | number | boolean | null | undefined>,
      });
      return dtoListToDomainNotifications(response.data.data);
    });
  }

  async unreadNotificationCount(): Promise<number> {
    return this.shadow('unreadNotificationCount', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'unreadNotificationCount', 'remote');
      const response = await this.client.get<UnreadNotificationCountResponseDto>('/v1/notifications/unread-count');
      return dtoUnreadCountToNumber(response.data.data);
    });
  }

  async markNotificationRead(notificationId: string, metadata: MarkNotificationReadRequestDto): Promise<number> {
    return this.shadow('markNotificationRead', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'markNotificationRead', 'remote');
      const request = domainToMarkNotificationReadDto(notificationId, metadata);
      const response = await this.client.post<MarkNotificationReadResponseDto>(`/v1/notifications/${notificationId}/read`, {
        body: request,
      });
      return responseToUnreadCount(response.data);
    });
  }

  async markNotificationUnread(notificationId: string, metadata: MarkNotificationUnreadRequestDto): Promise<number> {
    return this.shadow('markNotificationUnread', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'markNotificationUnread', 'remote');
      const request = domainToMarkNotificationUnreadDto(notificationId, metadata);
      const response = await this.client.post<MarkNotificationUnreadResponseDto>(`/v1/notifications/${notificationId}/unread`, {
        body: request,
      });
      return responseToUnreadCount(response.data);
    });
  }

  async markAllNotificationsRead(metadata: MarkAllNotificationsReadRequestDto): Promise<number> {
    return this.shadow('markAllNotificationsRead', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'markAllNotificationsRead', 'remote');
      const request = domainToMarkAllNotificationsReadDto(metadata);
      const response = await this.client.patch<MarkAllNotificationsReadResponseDto>('/v1/notifications/read-all', {
        body: request,
      });
      return responseToUnreadCount(response.data);
    });
  }

  async clearNotifications(metadata: ClearNotificationsRequestDto): Promise<number> {
    return this.shadow('clearNotifications', async () => {
      if (!this.client) throw createBackendUnavailableError('notification', 'clearNotifications', 'remote');
      const request = domainToClearNotificationsDto(metadata);
      const response = await this.client.delete<ClearNotificationsResponseDto>('/v1/notifications', {
        body: request,
      });
      return responseToUnreadCount(response.data);
    });
  }

  async getReadState(): Promise<NotificationReadState> {
    const notifications = await this.listNotifications();
    return toReadState(notifications);
  }

  async saveReadState(state: NotificationReadState): Promise<void> {
    const current = await this.getReadState().catch(() => ({ read: new Set<string>(), unread: new Set<string>() }));
    const localState = state;
    if (compareReadStateSemantics(localState, current)) {
      observability.metrics.counter('notifications.remote.semantic_mismatch', 1, {
        method: 'saveReadState',
        transport: this.transportLabel,
      });
      observability.logger.warn('NotificationsRemoteSemanticMismatch', {
        method: 'saveReadState',
        localShape: summarizeShape(notificationReadStateToDto(localState)),
        remoteShape: summarizeShape(notificationReadStateToDto(current)),
      });
    }

    for (const notificationId of localState.read) {
      await this.markNotificationRead(notificationId, {
        idempotencyKey: `notification:read:${notificationId}`,
        correlationId: `notification:read:${notificationId}`,
        actorId: notificationId,
        actorRole: 'customer',
        clientTimestamp: new Date().toISOString(),
        notificationId,
      });
    }
    for (const notificationId of localState.unread) {
      await this.markNotificationUnread(notificationId, {
        idempotencyKey: `notification:unread:${notificationId}`,
        correlationId: `notification:unread:${notificationId}`,
        actorId: notificationId,
        actorRole: 'customer',
        clientTimestamp: new Date().toISOString(),
        notificationId,
      });
    }
  }

  async markRead(notificationId: string): Promise<void> {
    await this.markNotificationRead(notificationId, {
      idempotencyKey: `notification:read:${notificationId}`,
      correlationId: `notification:read:${notificationId}`,
      actorId: notificationId,
      actorRole: 'customer',
      clientTimestamp: new Date().toISOString(),
      notificationId,
    });
  }

  async markUnread(notificationId: string): Promise<void> {
    await this.markNotificationUnread(notificationId, {
      idempotencyKey: `notification:unread:${notificationId}`,
      correlationId: `notification:unread:${notificationId}`,
      actorId: notificationId,
      actorRole: 'customer',
      clientTimestamp: new Date().toISOString(),
      notificationId,
    });
  }

  async clear(): Promise<void> {
    await this.clearNotifications({
      idempotencyKey: 'notification:clear',
      correlationId: 'notification:clear',
      actorId: 'notification-system',
      actorRole: 'system',
      clientTimestamp: new Date().toISOString(),
    });
  }
}

export function createRemoteNotificationRepositoryPrototype(options: RemoteNotificationRepositoryOptions = {}) {
  return new RemoteNotificationRepository(options);
}

export function createNotificationShadowRepository(options: {
  localRepository: NotificationRepository;
  remoteRepository: RemoteNotificationRepository;
}) {
  const { localRepository, remoteRepository } = options;

  return {
    async getReadState() {
      const local = await localRepository.getReadState();
      try {
        const remote = await remoteRepository.getReadState();
        if (compareReadStateSemantics(local, remote)) {
          observability.metrics.counter('notifications.remote.shape_mismatch', 1, { method: 'getReadState' });
          observability.metrics.counter('notifications.remote.semantic_mismatch', 1, { method: 'getReadState' });
          observability.logger.warn('NotificationsRemoteShadowMismatch', {
            method: 'getReadState',
            localShape: summarizeShape(notificationReadStateToDto(local)),
            remoteShape: summarizeShape(notificationReadStateToDto(remote)),
          });
        }
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'getReadState',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async saveReadState(state: NotificationReadState) {
      await localRepository.saveReadState(state);
      try {
        await remoteRepository.saveReadState(state);
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'saveReadState',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async markRead(notificationId: string) {
      await localRepository.markRead(notificationId);
      try {
        await remoteRepository.markRead(notificationId);
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'markRead',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async markUnread(notificationId: string) {
      await localRepository.markUnread(notificationId);
      try {
        await remoteRepository.markUnread(notificationId);
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'markUnread',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async clear() {
      await localRepository.clear();
      try {
        await remoteRepository.clear();
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'clear',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async listNotifications(input: NotificationFeedContext) {
      const local = await getLocalNotificationList(input);
      try {
        const remote = await remoteRepository.listNotifications();
        if (compareNotificationSemantics(local, remote)) {
          observability.metrics.counter('notifications.remote.shape_mismatch', 1, { method: 'listNotifications' });
          observability.metrics.counter('notifications.remote.semantic_mismatch', 1, { method: 'listNotifications' });
          observability.logger.warn('NotificationsRemoteShadowMismatch', {
            method: 'listNotifications',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
          });
        }
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'listNotifications',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async getUnreadNotificationCount(input: NotificationFeedContext) {
      const local = await getLocalUnreadNotificationCount(input);
      try {
        const remote = await remoteRepository.unreadNotificationCount();
        if (local !== remote) {
          observability.metrics.counter('notifications.remote.shape_mismatch', 1, { method: 'getUnreadNotificationCount' });
          observability.metrics.counter('notifications.remote.semantic_mismatch', 1, { method: 'getUnreadNotificationCount' });
          observability.logger.warn('NotificationsRemoteShadowMismatch', {
            method: 'getUnreadNotificationCount',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
          });
        }
      } catch (error) {
        observability.logger.warn('NotificationsRemoteShadowFailure', {
          method: 'getUnreadNotificationCount',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
  } satisfies NotificationRepository & {
    listNotifications(input: NotificationFeedContext): Promise<NotificationItem[]>;
    getUnreadNotificationCount(input: NotificationFeedContext): Promise<number>;
  };
}
