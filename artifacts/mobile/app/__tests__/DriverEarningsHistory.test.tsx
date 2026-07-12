import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import DriverEarningsHistoryScreen from '../driver-earnings-history';
import { loadStoredDriverDailyGoals } from '@/persistence/driverDailyGoalPersistence';
import {
  getDriverEarningsDateSelectionVersion,
  publishDriverEarningsDateSelection,
} from '@/persistence/driverEarningsDateSelectionSignal';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    AccessibilityInfo: {
      announceForAccessibility: jest.fn(),
    },
    ActivityIndicator: host('ActivityIndicator'),
    Pressable: host('Pressable'),
    View: host('View'),
    Text: host('Text'),
    TextInput: host('TextInput'),
    Modal: React.forwardRef((props: { visible?: boolean; children?: React.ReactNode }, ref: unknown) => {
      if (!props.visible) return null;
      return React.createElement('Modal', { ...props, ref }, props.children);
    }),
    FlatList: React.forwardRef(
      (
        props: {
          data?: Array<number>;
          renderItem?: (info: { item: number; index: number }) => React.ReactNode;
          keyExtractor?: (item: number, index: number) => string;
          testID?: string;
          initialScrollIndex?: number;
        },
        ref: unknown,
      ) => {
        const { data = [], renderItem, keyExtractor, testID, initialScrollIndex = 0 } = props;
        const center = Math.min(Math.max(0, initialScrollIndex), Math.max(0, data.length - 1));
        const start = Math.max(0, center - 2);
        const end = Math.min(data.length - 1, center + 2);
        const nodes = [];
        for (let index = start; index <= end; index += 1) {
          const item = data[index];
          nodes.push(
            React.createElement(
              React.Fragment,
              { key: keyExtractor ? keyExtractor(item, index) : String(index) },
              renderItem ? renderItem({ item, index }) : null,
            ),
          );
        }
        React.useImperativeHandle(ref, () => ({
          scrollToIndex: jest.fn(),
          scrollToOffset: jest.fn(),
        }));
        return React.createElement(
          'FlatList',
          { ref, testID, initialScrollIndex, dataLength: data.length },
          nodes,
        );
      },
    ),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    },
    useColorScheme: () => 'light',
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ selectedLocalDate: '2026-07-08' }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon };
});

jest.mock('@/components/BackButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    BackButton: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress?: () => void;
      accessibilityLabel?: string;
    }) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel ?? 'Go back'}>
        <Text>Back</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    foreground: '#000',
    background: '#fff',
    mutedForeground: '#666',
    muted: '#eee',
    card: '#fff',
    border: '#ddd',
    primaryHex: '#111',
    destructiveHex: '#f00',
  }),
}));

jest.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({
    currentLocalDate: '2026-07-10',
    refreshCurrentLocalDate: () => '2026-07-10',
  }),
}));

jest.mock('@/hooks/useReducedMotionPreference', () => ({
  useReducedMotionPreference: () => false,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' } }),
}));

jest.mock('@/query/hooks/useRideHistoryQuery', () => ({
  useRideHistoryQuery: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/persistence/driverDailyGoalPersistence', () => ({
  loadStoredDriverDailyGoals: jest.fn(async () => ({ data: [], source: 'current' })),
}));

jest.mock('@/components/driver-statistics/ProgressRing', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ProgressRing: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DriverEarningsHistoryScreen />
    </QueryClientProvider>,
  );
}

describe('DriverEarningsHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [],
      source: 'current',
    });
  });

  test('renders fixed header and month list for the selected date', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('driver-earnings-history-screen')).toBeTruthy());
    expect(screen.getByTestId('earnings-history-month-title')).toBeTruthy();
    expect(screen.getByText('July 2026')).toBeTruthy();
    expect(screen.queryByText('Earnings History')).toBeNull();
    expect(screen.getByLabelText('Back to Earnings')).toBeTruthy();
    expect(screen.queryByLabelText('Select today')).toBeNull();
    expect(screen.queryByLabelText('Jump to year')).toBeNull();
    expect(screen.getByTestId('earnings-history-weekday-header')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('earnings-history-calendar-list')).toBeTruthy());
    expect(screen.getByTestId('calendar-month-2026-07')).toBeTruthy();
  });

  test('selecting a date publishes return signal and navigates back', async () => {
    const before = getDriverEarningsDateSelectionVersion();
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('calendar-day-2026-07-06')).toBeTruthy());
    fireEvent.press(screen.getByTestId('calendar-day-2026-07-06'));
    expect(getDriverEarningsDateSelectionVersion()).toBe(before + 1);
    expect(router.back).toHaveBeenCalled();
  });

  test('Back without selection does not publish a date', async () => {
    publishDriverEarningsDateSelection('2026-07-01');
    const afterNoise = getDriverEarningsDateSelectionVersion();
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Back to Earnings')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Back to Earnings'));
    expect(router.back).toHaveBeenCalled();
    expect(getDriverEarningsDateSelectionVersion()).toBe(afterNoise);
  });
});
