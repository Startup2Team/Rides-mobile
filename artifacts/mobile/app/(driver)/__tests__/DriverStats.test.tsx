import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import DriverStats from '../stats';

const mockLoadHistory = jest.fn();

const mockEntitlement: DriverEntitlement = {
  ...EMPTY_DRIVER_ENTITLEMENT,
  activePackageId: 'growth',
  remainingRideCredits: 110,
  purchaseHistory: [
    {
      amount: 2_000,
      createdAt: '2026-06-08T10:00:00.000Z',
      completedAt: '2026-06-08T10:01:00.000Z',
      packageId: 'growth',
      phoneNumber: '+250788000000',
      provider: 'mtn',
      status: 'successful',
      transactionId: 'momo-package:growth:2026-06-08T10:00:00.000Z',
    },
    {
      amount: 2_000,
      createdAt: '2026-06-07T10:00:00.000Z',
      packageId: 'growth',
      phoneNumber: '+250788000000',
      provider: 'airtel',
      status: 'failed',
      transactionId: 'momo-package:growth:2026-06-07T10:00:00.000Z',
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
    loadHistory: mockLoadHistory,
    rideHistory: [],
  }),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

describe('DriverStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows package purchase history in the stats tab', async () => {
    render(<DriverStats />);

    await waitFor(() => expect(mockLoadHistory).toHaveBeenCalled());

    expect(screen.getByText('Statistics')).toBeTruthy();
    expect(screen.getByText('Track your driver performance')).toBeTruthy();
    expect(screen.getByText("TODAY'S ACTIVITY")).toBeTruthy();
    expect(screen.getByText('No trips completed today yet.')).toBeTruthy();
    expect(screen.getByText('Package History')).toBeTruthy();
    expect(screen.getByText('View Packages')).toBeTruthy();
    expect(screen.getAllByText('Balance')).toHaveLength(1);
    expect(screen.getAllByText('Growth Package')).toHaveLength(2);
    expect(screen.getByText('Successful')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText(/MTN Mobile Money/)).toBeTruthy();
    expect(screen.getByText(/Airtel Money/)).toBeTruthy();
    expect(screen.getAllByText('2,000 RWF')).toHaveLength(2);
    expect(screen.queryByText('How Stats Work')).toBeNull();
  });
});
