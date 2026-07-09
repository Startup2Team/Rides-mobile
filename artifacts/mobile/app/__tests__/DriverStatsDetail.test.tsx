import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DriverStatsDetail from '../driver-stats-detail';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
    Modal: host('Modal'),
    Animated: {
      Value: jest.fn(() => ({
        interpolate: jest.fn(() => ({})),
        setValue: jest.fn(),
      })),
      timing: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
      })),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: jest.fn((cb) => cb()),
  useLocalSearchParams: () => ({ metric: 'earnings', period: 'today' }),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/BackButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    BackButton: ({ onPress }: { onPress?: () => void }) => (
      <Pressable onPress={onPress} testID="back-button">
        <Text>Back</Text>
      </Pressable>
    ),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockSvg = (props: any) => <View {...props} />;
  return {
    __esModule: true,
    default: MockSvg,
    Circle: MockSvg,
    Path: MockSvg,
    G: MockSvg,
    Defs: MockSvg,
    Filter: MockSvg,
    FeGaussianBlur: MockSvg,
    RadialGradient: MockSvg,
    Stop: MockSvg,
    Ellipse: MockSvg,
    ClipPath: MockSvg,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, FontAwesome: Icon };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-1' },
    driverProfile: {
      acceptanceRate: 80,
      completedRides: 10,
      dailyDeclines: 2,
      dailyRides: 8,
      earningsTotal: 30_000,
    },
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: null,
    isLoading: false,
  }),
}));

jest.mock('@/query/hooks/useRideHistoryQuery', () => ({
  useRideHistoryQuery: () => ({
    data: [
      {
        id: 'ride-1',
        agreedFare: 12000,
        createdAt: '2026-07-08T09:00:00.000Z',
        status: 'completed',
        driverId: 'driver-1',
        vehicleType: 'moto',
      }
    ],
    isLoading: false,
  }),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('DriverStatsDetail UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-07-08T14:30:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders detail hierarchy with large ring and metric cards', async () => {
    renderWithQueryClient(<DriverStatsDetail />);

    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.queryByText('Goal: 30000')).toBeNull();
    expect(screen.getByText('Activity breakdown')).toBeTruthy();
    expect(screen.getByText('Daily Metrics Summary')).toBeTruthy();
  });
});
