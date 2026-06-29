import type { NotificationFeedContext, NotificationReadState } from '../types';
import fs from 'fs';
import path from 'path';
import { getNotificationDayBucket } from '../hooks';
import { getUnreadNotificationCount, listNotifications, notificationRepository } from '../repository';

const mockGetReadState = jest.fn();

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

describe('notifications domain boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports the repository entry point and applies read state to the local feed', async () => {
    const readState: NotificationReadState = {
      read: new Set(['system_1']),
      unread: new Set(['ride_ride-1']),
    };
    mockGetReadState.mockResolvedValue(readState);

    const feedContext: NotificationFeedContext = {
      currentRide: null,
      pendingRequest: null,
      rideHistory: [{ id: 'ride-1', completedAt: '2026-06-28T08:00:00.000Z' } as any],
      driverMode: false,
      entitlement: { updatedAt: '2026-06-28T00:00:00.000Z', purchaseHistory: [] } as any,
      rideCredits: 20,
    };

    expect(notificationRepository).toBeTruthy();
    const notifications = await listNotifications(feedContext);

    expect(notifications.find(item => item.id === 'system_1')?.read).toBe(true);
    expect(notifications.find(item => item.id === 'ride_ride-1')?.read).toBe(false);
    expect(await getUnreadNotificationCount(feedContext)).toBeGreaterThan(0);
    expect(getNotificationDayBucket(new Date().toISOString())).toBe('today');
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
