import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteNotificationRepository, createNotificationShadowRepository } from '../repositories/RemoteNotificationRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import type { NotificationFeedContext, NotificationItem, NotificationReadState } from '@/domains/notifications';
import type { NotificationRepository } from '@/data/repositories/interfaces';
import { rideRepository } from '@/data/repositories';
import type { DriverEntitlement } from '@/domain/driverRidePackages';

const mockLocalListNotifications = jest.fn();
const mockLocalUnreadNotificationCount = jest.fn();

jest.mock('@/domains/notifications/repository', () => ({
  notificationRepository: {
    getReadState: jest.fn(),
    saveReadState: jest.fn(),
    markRead: jest.fn(),
    markUnread: jest.fn(),
    clear: jest.fn(),
  },
  listNotifications: (...args: unknown[]) => mockLocalListNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) => mockLocalUnreadNotificationCount(...args),
  getNotificationAccentColor: jest.fn(),
}));

const localNotifications: NotificationItem[] = [
  {
    id: 'notification-1',
    type: 'ride',
    icon: 'check-circle',
    title: 'Ride completed',
    message: 'Done',
    time: '2026-06-28T12:00:00.000Z',
    read: false,
    rideId: 'ride-1',
  },
  {
    id: 'notification-2',
    type: 'system',
    icon: 'clock',
    title: 'System update',
    message: 'Updated',
    time: '2026-06-27T12:00:00.000Z',
    read: true,
  },
];

const localReadState: NotificationReadState = {
  read: new Set(['notification-2']),
  unread: new Set(['notification-1']),
};

function createMetadata(overrides: Partial<{
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: 'customer' | 'driver' | 'system';
  clientTimestamp: string;
  notificationId: string;
}> = {}) {
  return {
    idempotencyKey: 'notification:meta:1',
    correlationId: 'corr-notification-1',
    actorId: 'user-1',
    actorRole: 'customer' as const,
    clientTimestamp: '2026-07-02T10:00:00.000Z',
    notificationId: 'notification-1',
    ...overrides,
  };
}

const feedContext: NotificationFeedContext = {
  currentRide: null,
  pendingRequest: null,
  rideHistory: [],
  driverMode: false,
  entitlement: {} as unknown as DriverEntitlement,
  rideCredits: 20,
};

describe('RemoteNotificationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetObservabilityForTests();
    mockLocalListNotifications.mockResolvedValue(localNotifications);
    mockLocalUnreadNotificationCount.mockResolvedValue(1);
  });

  test('maps list DTOs to domain models', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/notifications',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                {
                  id: 'notification-1',
                  title: 'Promo offer',
                  body: 'Weekend promo is live',
                  readAt: null,
                  createdAt: '2026-06-28T12:00:00.000Z',
                  category: 'promo',
                  rideId: null,
                },
              ],
              nextCursor: null,
              hasMore: false,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.listNotifications({ cursor: 'cursor-1', limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: 'notification-1',
        type: 'promo',
        icon: 'gift',
        title: 'Promo offer',
        message: 'Weekend promo is live',
        read: false,
      }),
    ]);
  });

  test('unread count maps correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/notifications/unread-count',
        response: {
          status: 200,
          data: {
            data: { count: 3 },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.unreadNotificationCount()).resolves.toBe(3);
  });

  test('mark read maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/notifications/notification-1/read',
        response: {
          status: 200,
          data: {
            data: {
              notificationId: 'notification-1',
              readAt: '2026-07-02T10:00:00.000Z',
              unreadCount: 1,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.markNotificationRead('notification-1', createMetadata())).resolves.toBe(1);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/notifications/notification-1/read',
      body: expect.objectContaining({
        notificationId: 'notification-1',
        idempotencyKey: 'notification:meta:1',
      }),
    });
  });

  test('mark unread maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/notifications/notification-1/unread',
        response: {
          status: 200,
          data: {
            data: {
              notificationId: 'notification-1',
              readAt: null,
              unreadCount: 2,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.markNotificationUnread('notification-1', createMetadata())).resolves.toBe(2);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/notifications/notification-1/unread',
      body: expect.objectContaining({
        notificationId: 'notification-1',
      }),
    });
  });

  test('mark all read maps correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/notifications/read-all',
        response: {
          status: 200,
          data: {
            data: {
              updatedCount: 2,
              unreadCount: 0,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.markAllNotificationsRead(createMetadata())).resolves.toBe(0);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/notifications/read-all',
      body: expect.objectContaining({
        idempotencyKey: 'notification:meta:1',
      }),
    });
  });

  test('clear maps correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'DELETE',
        path: '/v1/notifications',
        response: {
          status: 200,
          data: {
            data: {
              clearedCount: 2,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.clearNotifications(createMetadata({ actorRole: 'system', actorId: 'system' }))).resolves.toBe(0);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/v1/notifications',
    });
  });

  test('typed errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/notifications', error: new TimeoutError({ repository: 'notification', method: 'listNotifications', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/notifications/notification-1/read', error: new OfflineError({ repository: 'notification', method: 'markNotificationRead', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'PATCH', path: '/v1/notifications/read-all', error: new ServerError({ repository: 'notification', method: 'markAllNotificationsRead', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemoteNotificationRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemoteNotificationRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemoteNotificationRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.listNotifications()).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.markNotificationRead('notification-1', createMetadata())).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.markAllNotificationsRead(createMetadata())).rejects.toBeInstanceOf(ServerError);
  });
});

describe('notifications shadow remote wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetObservabilityForTests();
    mockLocalListNotifications.mockResolvedValue(localNotifications);
    mockLocalUnreadNotificationCount.mockResolvedValue(1);
  });

  test('returns local results even when remote fails', async () => {
    const localRepository: NotificationRepository = {
      getReadState: jest.fn(async () => localReadState),
      saveReadState: jest.fn(async () => undefined),
      markRead: jest.fn(async () => undefined),
      markUnread: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    };
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/notifications', error: new TimeoutError({ repository: 'notification', method: 'listNotifications', transport: 'remote' }) },
      { method: 'GET', path: '/v1/notifications/unread-count', error: new TimeoutError({ repository: 'notification', method: 'unreadNotificationCount', transport: 'remote' }) },
      { method: 'POST', path: '/v1/notifications/notification-1/read', error: new TimeoutError({ repository: 'notification', method: 'markNotificationRead', transport: 'remote' }) },
      { method: 'POST', path: '/v1/notifications/notification-1/unread', error: new TimeoutError({ repository: 'notification', method: 'markNotificationUnread', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/notifications/read-all', error: new TimeoutError({ repository: 'notification', method: 'markAllNotificationsRead', transport: 'remote' }) },
      { method: 'DELETE', path: '/v1/notifications', error: new TimeoutError({ repository: 'notification', method: 'clearNotifications', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createNotificationShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getReadState()).resolves.toEqual(localReadState);
    await expect(shadowRepository.saveReadState(localReadState)).resolves.toBeUndefined();
    await expect(shadowRepository.markRead('notification-1')).resolves.toBeUndefined();
    await expect(shadowRepository.markUnread('notification-1')).resolves.toBeUndefined();
    await expect(shadowRepository.clear()).resolves.toBeUndefined();
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository: NotificationRepository = {
      getReadState: jest.fn(async () => localReadState),
      saveReadState: jest.fn(async () => undefined),
      markRead: jest.fn(async () => undefined),
      markUnread: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/notifications',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                {
                  id: 'notification-1',
                  title: 'Ride completed',
                  body: 'Done',
                  readAt: null,
                  createdAt: '2026-06-28T12:00:00.000Z',
                  category: 'ride',
                  rideId: 'ride-1',
                },
                {
                  id: 'notification-2',
                  title: 'Different system update',
                  body: 'Changed',
                  readAt: null,
                  createdAt: '2026-06-27T12:00:00.000Z',
                  category: 'system',
                  rideId: null,
                },
              ],
              nextCursor: null,
              hasMore: false,
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/notifications/unread-count',
        response: {
          status: 200,
          data: {
            data: { count: 2 },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createNotificationShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.listNotifications(feedContext)).resolves.toEqual(localNotifications);
    await expect(shadowRepository.getUnreadNotificationCount(feedContext)).resolves.toBe(1);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'notifications.remote.shadow',
      'notifications.remote.latency_ms',
      'notifications.remote.shape_mismatch',
      'notifications.remote.semantic_mismatch',
    ]));
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });

  test('notification actions do not mutate ride lifecycle state', async () => {
    const before = await rideRepository.loadRideHistory();
    const localRepository: NotificationRepository = {
      getReadState: jest.fn(async () => localReadState),
      saveReadState: jest.fn(async () => undefined),
      markRead: jest.fn(async () => undefined),
      markUnread: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/notifications',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                {
                  id: 'notification-1',
                  title: 'Ride completed',
                  body: 'Done',
                  readAt: null,
                  createdAt: '2026-06-28T12:00:00.000Z',
                  category: 'ride',
                  rideId: 'ride-1',
                },
              ],
              nextCursor: null,
              hasMore: false,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteNotificationRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createNotificationShadowRepository({
      localRepository,
      remoteRepository,
    });

    await shadowRepository.listNotifications(feedContext);
    const after = await rideRepository.loadRideHistory();
    expect(after).toEqual(before);
  });
});
