import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import DriverStats from '../stats';

const mockListRideHistory = jest.fn();

let mockEntitlement: DriverEntitlement = {
  ...EMPTY_DRIVER_ENTITLEMENT,
  activePackageId: 'growth',
  remainingRideCredits: 110,
  purchaseHistory: [
    {
      amount: 2_000,
      bonusRidesGranted: 15,
      createdAt: '2026-06-08T10:00:00.000Z',
      completedAt: '2026-06-08T10:01:00.000Z',
      packageName: 'Growth Package',
      packageId: 'growth',
      packageVersion: 'v1',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      phoneNumber: '+250788000000',
      provider: 'mtn',
      status: 'successful',
      transactionId: 'momo-package:growth:2026-06-08T10:00:00.000Z',
      purchasedAt: '2026-06-08T10:00:00.000Z',
      pricePaid: 2_000,
      ridesGranted: 60,
    },
    {
      amount: 2_000,
      bonusRidesGranted: 15,
      createdAt: '2026-06-07T10:00:00.000Z',
      packageName: 'Growth Package',
      packageId: 'growth',
      packageVersion: 'v1',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      phoneNumber: '+250788000000',
      provider: 'airtel',
      status: 'failed',
      transactionId: 'momo-package:growth:2026-06-07T10:00:00.000Z',
      purchasedAt: '2026-06-07T10:00:00.000Z',
      pricePaid: 2_000,
      ridesGranted: 60,
    },
  ],
  updatedAt: '2026-06-08T10:00:00.000Z',
};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: (props: object) => <View {...props} /> };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: object) => <View {...props} /> };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, FontAwesome: Icon };
});

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-1' },
    driverProfile: {
      acceptanceRate: 100,
      completedRides: 0,
      dailyDeclines: 0,
      dailyRides: 0,
      earningsTotal: 0,
      merchantCode: '',
      momoCode: '+250788000000',
    },
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

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    rideHistory: [],
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

describe('DriverStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListRideHistory.mockResolvedValue([]);
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows package purchase history in the stats tab', async () => {
    renderWithQueryClient(<DriverStats />);

    await waitFor(() => expect(mockListRideHistory).toHaveBeenCalled());

    expect(screen.getByText('Statistics')).toBeTruthy();
    expect(screen.getByText("TODAY'S ACTIVITY")).toBeTruthy();
    expect(screen.getByText('No trips completed today yet.')).toBeTruthy();
    expect(screen.getByText('Package History')).toBeTruthy();
    expect(screen.getByText('View Packages')).toBeTruthy();
    expect(screen.getAllByText('Rides')).toHaveLength(1);
    expect(screen.getAllByText('Growth Package')).toHaveLength(2);
    expect(screen.getByText('Successful')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText(/MTN Mobile Money/)).toBeTruthy();
    expect(screen.getByText(/Airtel Money/)).toBeTruthy();
    expect(screen.getAllByText('2,000 RWF')).toHaveLength(2);
    expect(screen.queryByText('How Stats Work')).toBeNull();
  });

  test('renders package history from purchase snapshots', async () => {
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      activePackageId: 'archived_growth_2026',
      remainingRideCredits: 70,
      purchaseHistory: [
        {
          amount: 2_500,
          bonusRidesGranted: 20,
          createdAt: '2026-06-09T10:00:00.000Z',
          packageName: 'Growth Package v2',
          packageId: 'archived_growth_2026',
          packageVersion: 'v2',
          phoneNumber: '+250788000000',
          provider: 'mtn',
          purchasedAt: '2026-06-09T10:00:00.000Z',
          pricePaid: 2_500,
          ridesGranted: 70,
          status: 'successful',
          transactionId: 'momo-package:growth:2026-06-09T10:00:00.000Z',
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
        },
      ],
      updatedAt: '2026-06-09T10:00:00.000Z',
    };

    renderWithQueryClient(<DriverStats />);

    await waitFor(() => expect(mockListRideHistory).toHaveBeenCalled());

    expect(screen.getByText('Growth Package v2')).toBeTruthy();
    expect(screen.getByText('70 Rides + 20 Bonus Rides')).toBeTruthy();
    expect(screen.getByText('2,500 RWF')).toBeTruthy();
  });
});
