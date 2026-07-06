import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DriverRating } from '@/domain/driverWallet';
import type { DriverProfile, User } from '@/types';
import DriverProfileScreen from '../profile';

let mockRatings: DriverRating[] = [];

const user: User = {
  id: 'driver-1',
  name: 'Test Driver',
  phone: '+250788000000',
  mode: 'driver',
  isDriver: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const driverProfile: DriverProfile = {
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  licenseNumber: '1234567890123456',
  province: 'City of Kigali',
  district: 'Gasabo',
  sector: 'Kacyiru',
  momoCode: '250788000000',
  momoProvider: 'mtn',
  dob: '01/01/1990',
  verificationStatus: 'approved',
  isOnline: false,
  isVerified: true,
  acceptanceRate: 100,
  completedRides: 0,
  dailyRides: 0,
  dailyDeclines: 0,
  policyAccepted: true,
  earningsTotal: 0,
};

function rating(overrides: Partial<DriverRating>): DriverRating {
  return {
    id: 'rating-1',
    rideId: 'ride-1',
    driverId: 'driver-1',
    customerId: 'customer-1',
    stars: 5,
    moderationStatus: 'published',
    createdAt: '2026-06-08T10:00:00.000Z',
    idempotencyKey: 'driver-rating:completed-ride:ride-1',
    authority: 'local_prototype',
    ...overrides,
  };
}

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Modal: host('Modal'),
    Pressable: host('Pressable'),
    Animated: {
      View: host('AnimatedView'),
      Value: class {
        setValue = jest.fn();
        interpolate = jest.fn(() => 0);
      },
      timing: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
      spring: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
      parallel: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
    },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    Image: host('Image'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useFocusEffect: (effect: () => void | (() => void)) => effect(),
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

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScrollView: (props: { children: React.ReactNode }) => <View>{props.children}</View> };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: object) => <View {...props} /> };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, MaterialCommunityIcons: Icon, FontAwesome: Icon };
});

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('@/components/ImageGalleryPreview', () => ({
  ImageGalleryPreview: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user,
    driverProfile,
    logout: jest.fn(),
    switchMode: jest.fn(),
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: { activePackageId: null },
    isLoading: false,
    bonusRides: 0,
    rideCredits: 0,
    totalAvailableRides: 0,
  }),
}));

jest.mock('@/domains/vehicle', () => ({
  useVehicles: () => ({
    vehicles: [],
    isLoading: false,
    isRefreshing: false,
    refreshVehicles: jest.fn(),
    addVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    deleteVehicle: jest.fn(),
    setPrimaryVehicle: jest.fn(),
  }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    rideHistory: [],
    loadHistory: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/query/hooks/useRideHistoryQuery', () => ({
  useRideHistoryQuery: () => ({
    data: [],
    refetch: jest.fn(() => Promise.resolve({ data: [] })),
  }),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: mockRatings, source: 'current' })),
}));

jest.mock('@/persistence/profilePersistence', () => ({
  loadStoredProfileImage: jest.fn(() => Promise.resolve({ data: null, source: 'missing' })),
}));

describe('DriverProfileScreen rating summary', () => {
  beforeEach(() => {
    mockRatings = [];
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('profile displays default rating when none exists', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <DriverProfileScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('5.0')[0]).toBeTruthy());
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('My vehicles')).toBeTruthy();
    expect(screen.queryByText('Driver Documents')).toBeNull();
    expect(screen.queryByText('Plate Number')).toBeNull();
    expect(screen.queryByText('License')).toBeNull();
  });

  test('profile displays rating summary when ratings exist', async () => {
    mockRatings = [
      rating({ id: 'rating-1', rideId: 'ride-1', stars: 5 }),
      rating({ id: 'rating-2', rideId: 'ride-2', stars: 4, idempotencyKey: 'driver-rating:completed-ride:ride-2' }),
      rating({ id: 'rating-3', rideId: 'ride-3', driverId: 'driver-2', stars: 1, idempotencyKey: 'driver-rating:completed-ride:ride-3' }),
    ];

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <DriverProfileScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('4.5')[0]).toBeTruthy());
  });
});
