import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import NotificationsScreen from '../notifications';

const mockPush = jest.fn();
const mockLoadHistory = jest.fn();
const mockShowToast = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkUnread = jest.fn();
const mockMarkAllRead = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const React = require('react');
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = ({ name }: { name: string }) => React.createElement('Text', null, name);
  return { Feather: Icon };
});

jest.mock('@/components/GlassHeader', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    GlassHeader: ({ title, right }: any) => (
      <View>
        <Text>{title}</Text>
        {right}
      </View>
    ),
    useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0, headerInset: 0 }),
  };
});

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#fff',
    primary: '#0057ff',
    primaryHex: '#0057ff',
    destructive: '#d00',
    mutedForeground: '#666',
    foreground: '#111',
    successHex: '#0a0',
    star: '#f5b301',
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', mode: 'customer' },
  }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    loadHistory: (...args: unknown[]) => mockLoadHistory(...args),
  }),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: (...args: unknown[]) => mockShowToast(...args),
  }),
}));

jest.mock('@/domains/notifications', () => {
  const notifications = [
    {
      id: 'ride-1',
      type: 'ride',
      icon: 'check-circle',
      title: 'Ride completed',
      message: 'Your ride was completed.',
      time: '2026-06-28T10:00:00.000Z',
      read: false,
      rideId: 'ride-123',
    },
    {
      id: 'system-1',
      type: 'system',
      icon: 'clock',
      title: 'App update',
      message: 'Updated successfully.',
      time: '2026-06-27T10:00:00.000Z',
      read: true,
    },
  ];
  return {
    getNotificationAccentColor: () => '#0057ff',
    getNotificationDayBucket: () => 'today',
    useNotifications: () => ({
      notifications,
      unreadCount: 1,
      sections: { today: notifications.slice(0, 1), yesterday: notifications.slice(1), previous: [] },
      isLoading: false,
      isRefreshing: false,
      refreshNotifications: jest.fn(),
      markNotificationRead: (...args: unknown[]) => mockMarkRead(...args),
      markNotificationUnread: (...args: unknown[]) => mockMarkUnread(...args),
      markAllNotificationsRead: (...args: unknown[]) => mockMarkAllRead(...args),
      clearNotifications: jest.fn(),
    }),
  };
});

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders query-backed notifications and keeps the same actions', () => {
    render(<NotificationsScreen />);

    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Ride completed')).toBeTruthy();
    expect(screen.getByText('Mark all read')).toBeTruthy();

    fireEvent.press(screen.getByText('Ride completed'));

    expect(mockMarkRead).toHaveBeenCalledWith('ride-1');
    expect(mockPush).toHaveBeenCalledWith('/ride-detail?rideId=ride-123');
  });

  test('mark all read still triggers the same action', () => {
    render(<NotificationsScreen />);

    fireEvent.press(screen.getByText('Mark all read'));

    expect(mockMarkAllRead).toHaveBeenCalled();
  });
});
