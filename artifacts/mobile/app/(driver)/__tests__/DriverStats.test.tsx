import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import type { Ride } from '@/types';
import DriverStats from '../stats';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';

const mockListRideHistory = jest.fn();

let mockRideHistory: Ride[] = [];
let mockDriverProfile = {
  acceptanceRate: 80,
  completedRides: 10,
  dailyDeclines: 2,
  dailyRides: 8,
  earningsTotal: 30_000,
  merchantCode: '',
  momoCode: '+250788000000',
};
let mockEntitlement: DriverEntitlement = {
  ...EMPTY_DRIVER_ENTITLEMENT,
  remainingBonusRides: 5,
  remainingRideCredits: 12,
  purchaseHistory: [
    {
      amount: 2_000,
      createdAt: '2026-07-08T10:00:00.000Z',
      packageId: 'growth',
      phoneNumber: '+250788000000',
      provider: 'mtn',
      status: 'successful',
      transactionId: 'momo-package:growth:2026-07-08T10:00:00.000Z',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
    },
  ],
  updatedAt: '2026-07-08T10:00:00.000Z',
};

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
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
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
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, FontAwesome: Icon };
});

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children, onRefresh }: { children?: React.ReactNode; onRefresh?: () => void }) => {
    const React = require('react');
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text onPress={onRefresh}>Refresh stats</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-1' },
    driverProfile: mockDriverProfile,
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: mockEntitlement,
    isLoading: false,
    bonusRides: mockEntitlement.remainingBonusRides,
    rideCredits: mockEntitlement.remainingRideCredits,
    totalAvailableRides: mockEntitlement.remainingRideCredits + mockEntitlement.remainingBonusRides,
  }),
}));

jest.mock('@/domains/ride', () => ({
  rideHistoryRepository: {
    listRideHistory: (...args: unknown[]) => mockListRideHistory(...args),
    getRideDetail: jest.fn(),
  },
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

function ride(overrides: Partial<Ride>): Ride {
  return {
    agreedFare: 1_000,
    completedAt: '2026-07-08T09:00:00.000Z',
    createdAt: '2026-07-08T08:30:00.000Z',
    customerId: 'customer-1',
    destination: { address: 'Destination', latitude: -1.95, longitude: 30.08 },
    distance: 4,
    driverId: 'driver-1',
    duration: 12,
    id: 'ride-1',
    negotiation: [],
    pickup: { address: 'Pickup', latitude: -1.94, longitude: 30.06 },
    status: 'completed',
    suggestedFare: 900,
    vehicleType: 'moto',
    ...overrides,
  };
}

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

describe('DriverStats Summary UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-07-08T14:30:00.000Z') });
    mockDriverProfile = {
      acceptanceRate: 80,
      completedRides: 10,
      dailyDeclines: 2,
      dailyRides: 8,
      earningsTotal: 30_000,
      merchantCode: '',
      momoCode: '+250788000000',
    };
    mockRideHistory = [
      ride({ id: 'today-1', agreedFare: 1_000, completedAt: '2026-07-08T09:00:00.000Z' }),
      ride({ id: 'week-1', agreedFare: 2_000, completedAt: '2026-07-06T12:00:00.000Z' }),
      ride({ id: 'month-1', agreedFare: 4_000, completedAt: '2026-07-01T12:00:00.000Z' }),
      ride({ id: 'other-driver', driverId: 'driver-2', agreedFare: 9_000, completedAt: '2026-07-08T10:00:00.000Z' }),
      ride({ id: 'cancelled', status: 'cancelled', agreedFare: 9_000, completedAt: '2026-07-08T10:00:00.000Z' }),
    ];
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      remainingBonusRides: 5,
      remainingRideCredits: 12,
      purchaseHistory: [],
      updatedAt: '2026-07-08T10:00:00.000Z',
    };
    mockListRideHistory.mockImplementation(() => Promise.resolve(mockRideHistory));
    (loadStoredDriverRatings as jest.Mock).mockResolvedValue({
      data: [
        {
          authority: 'local_prototype',
          driverId: 'driver-1',
          id: 'rating-1',
          idempotencyKey: 'rating-1',
          moderationStatus: 'published',
          rideId: 'today-1',
          stars: 5,
          createdAt: '2026-07-08T10:00:00.000Z',
        },
      ],
    });
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('renders the Summary hierarchy and removes package/payment drift', async () => {
    renderWithQueryClient(<DriverStats />);

    await waitFor(() => expect(screen.getAllByText('1,000 RWF').length).toBeGreaterThan(0));

    expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wednesday/).length).toBeGreaterThan(0);
    expect(screen.getByText('Earnings')).toBeTruthy();
    expect(screen.getByText('Completed Trips')).toBeTruthy();
    expect(screen.getByText('Earnings Per Trip')).toBeTruthy();
    expect(screen.getByText('Driver Rating')).toBeTruthy();
    expect(screen.getByText('Acceptance')).toBeTruthy();
    expect(screen.getByText('Trends')).toBeTruthy();
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.queryByText('Package History')).toBeNull();
    expect(screen.queryByText('Mobile Money Details')).toBeNull();
    expect(screen.queryByText('Bonus Rides')).toBeNull();
  });

  test('does not render fake goals, fake percentages, or fake benchmark language', async () => {
    renderWithQueryClient(<DriverStats />);

    await waitFor(() => expect(screen.getAllByText('1,000 RWF').length).toBeGreaterThan(0));

    expect(screen.queryByText(/goal/i)).toBeNull();
    expect(screen.queryByText(/50,000/)).toBeNull();
    expect(screen.queryByText(/% complete|completion progress|goal progress/i)).toBeNull();
    expect(screen.queryByText(/improved/i)).toBeNull();
    expect(screen.queryByText(/better than/i)).toBeNull();
    expect(screen.queryByText(/top driver/i)).toBeNull();
    expect(screen.queryByText(/local_profile/i)).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
  });

  test('new-driver state renders truthful zero and unavailable states', async () => {
    mockRideHistory = [];
    mockDriverProfile = {
      acceptanceRate: 0,
      completedRides: 0,
      dailyDeclines: 0,
      dailyRides: 0,
      earningsTotal: 0,
      merchantCode: '',
      momoCode: '',
    };
    mockListRideHistory.mockResolvedValue([]);
    (loadStoredDriverRatings as jest.Mock).mockResolvedValue({ data: [] });

    renderWithQueryClient(<DriverStats />);

    await waitFor(() => expect(screen.getByText('0 RWF')).toBeTruthy());

    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.getByText('No rating yet')).toBeTruthy();
    expect(screen.getByText('Keep driving to unlock your trends.')).toBeTruthy();
    expect(screen.getByText('Complete trips across more active periods and Rides will show when you perform best.')).toBeTruthy();
    expect(screen.queryByText(/random/i)).toBeNull();
    expect(screen.queryByText(/yesterday/i)).toBeNull();
    expect(screen.queryByText(/last week/i)).toBeNull();
  });
});
