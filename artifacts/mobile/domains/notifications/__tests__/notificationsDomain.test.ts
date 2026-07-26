import type { NotificationFeedContext, NotificationReadState } from '../types';
import fs from 'fs';
import path from 'path';
import { getNotificationDayBucket, notificationCalendarDaysAgo } from '../hooks';
import { getUnreadNotificationCount, listNotifications, notificationRepository } from '../repository';

const mockGetReadState = jest.fn();
const mockApiListNotifications = jest.fn();

jest.mock('@/constants/systemColors', () => ({
  APPLE_SYSTEM_BLUE_HEX: { light: '#0057ff' },
}));

jest.mock('@/data/repositories', () => ({
  notificationRepository: {
    getReadState: (...args: unknown[]) => mockGetReadState(...args),
    saveReadState: jest.fn(),
    markRead: jest.fn(),
    markUnread: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('@/services/notifications', () => ({
  listNotifications: (...args: unknown[]) => mockApiListNotifications(...args),
}));

// Break the native-module import chain (AuthContext -> expo-constants, and the
// remote-repository re-export) so this pure-logic suite runs without the RN
// runtime. Mirrors the mocking pattern used by the query-layer tests.
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/data/remote/repositories/RemoteNotificationRepository', () => ({
  createRemoteNotificationRepositoryPrototype: jest.fn(),
  createNotificationShadowRepository: jest.fn(),
}));

const feedContext: NotificationFeedContext = {
  currentRide: null,
  pendingRequest: null,
  rideHistory: [],
  driverMode: false,
  entitlement: { updatedAt: '2026-06-28T00:00:00.000Z', purchaseHistory: [] } as any,
  rideCredits: 20,
};

describe('notifications domain boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('feed is sourced only from the backend and applies the local read overlay', async () => {
    const readState: NotificationReadState = {
      read: new Set(['backend-read']),
      unread: new Set(['backend-unread']),
    };
    mockGetReadState.mockResolvedValue(readState);
    mockApiListNotifications.mockResolvedValue([
      { id: 'backend-read', title: 'Server read', body: 'x', type: 'system', data: {}, isRead: false, sentAt: '2026-06-28T09:00:00.000Z', readAt: null },
      { id: 'backend-unread', title: 'Server unread', body: 'y', type: 'ride', data: {}, isRead: true, sentAt: '2026-06-28T08:00:00.000Z', readAt: null },
      { id: 'backend-plain', title: 'Server plain', body: 'z', type: 'promo', data: {}, isRead: false, sentAt: '2026-06-28T07:00:00.000Z', readAt: null },
    ]);

    expect(notificationRepository).toBeTruthy();
    const notifications = await listNotifications(feedContext);

    // No client-synthesized items leak into the feed.
    expect(notifications.every(item => item.source === 'backend')).toBe(true);
    expect(notifications).toHaveLength(3);

    // Local overlay wins over the server flag in both directions.
    expect(notifications.find(item => item.id === 'backend-read')?.read).toBe(true);
    expect(notifications.find(item => item.id === 'backend-unread')?.read).toBe(false);
    expect(notifications.find(item => item.id === 'backend-plain')?.read).toBe(false);

    // Unread count derives from the (overlaid) backend feed.
    expect(await getUnreadNotificationCount(feedContext)).toBe(2);
    expect(getNotificationDayBucket(new Date().toISOString())).toBe('today');
  });

  test('empty backend feed yields an empty list', async () => {
    mockGetReadState.mockResolvedValue({ read: new Set(), unread: new Set() });
    mockApiListNotifications.mockResolvedValue([]);

    expect(await listNotifications(feedContext)).toEqual([]);
    expect(await getUnreadNotificationCount(feedContext)).toBe(0);
  });

  test('screens do not import notification persistence directly', () => {
    const screenPaths = [
      path.join(__dirname, '../../../app/notifications.tsx'),
      path.join(__dirname, '../../../components/HomeTopHeader.tsx'),
      path.join(__dirname, '../../../app/(driver)/index.tsx'),
    ];

    screenPaths.forEach(screenPath => {
      const source = fs.readFileSync(screenPath, 'utf8');
      expect(source).not.toContain('notificationPersistence');
    });
  });
});

describe('calendar-day bucketing', () => {
  const now = new Date(2026, 6, 26, 11, 3); // Sun 26 Jul 2026, 11:03 local

  test('counts calendar days, not elapsed 24h windows', () => {
    // 45 hours earlier, but two calendar days back. Computing this as
    // floor(hours / 24) gave 1, so the row read "1d ago" while the section
    // headings put it under Previous and Yesterday showed "No notifications" —
    // which looked like the feed had failed to load.
    const twoCalendarDaysAgo = new Date(2026, 6, 24, 13, 36).toISOString();
    expect(notificationCalendarDaysAgo(twoCalendarDaysAgo, now)).toBe(2);
    expect(getNotificationDayBucket(twoCalendarDaysAgo)).toBe('previous');
  });

  test('late last night is one day ago, not zero', () => {
    // Two hours elapsed, but a different calendar day.
    const lastNight = new Date(2026, 6, 25, 23, 30).toISOString();
    expect(notificationCalendarDaysAgo(lastNight, new Date(2026, 6, 26, 1, 30))).toBe(1);
  });

  test('earlier the same day is zero days ago', () => {
    expect(notificationCalendarDaysAgo(new Date(2026, 6, 26, 0, 5).toISOString(), now)).toBe(0);
  });

  test('an unparseable timestamp falls back to previous rather than throwing', () => {
    expect(getNotificationDayBucket('not-a-date')).toBe('previous');
  });
});
