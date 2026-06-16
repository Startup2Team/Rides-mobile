import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { DriverEntitlementProvider } from '@/context/DriverEntitlementContext';
import { RideProvider } from '@/context/RideContext';
import { activatePackage, EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { STORAGE_KEYS } from '@/constants/storage';
import { saveStoredDriverProfile, saveStoredUser, loadStoredDriverProfile } from '@/persistence/authPersistence';
import { saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import { saveStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { saveSecureStorage } from '@/persistence/secureStorage';
import type { DriverRating } from '@/domain/driverWallet';
import type { DriverProfile, Ride, User } from '@/types';
import DriverDashboard from '../index';

let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
    setValue(nextValue: number) {
      this.value = nextValue;
    }
    stopAnimation(callback?: (value: number) => void) {
      callback?.(this.value);
    }
  }
  const animation = () => ({ start: (callback?: () => void) => callback?.() });
  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: jest.fn(animation),
      spring: jest.fn(animation),
      parallel: jest.fn(() => animation()),
      sequence: jest.fn(() => animation()),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Image: host('Image'),
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    PanResponder: {
      create: (config: Record<string, (...args: unknown[]) => unknown>) => ({
        panHandlers: {
          onResponderGrant: config.onPanResponderGrant,
          onResponderMove: config.onPanResponderMove,
          onResponderRelease: config.onPanResponderRelease,
          onResponderTerminate: config.onPanResponderTerminate,
        },
      }),
    },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: {
      absoluteFill: {},
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    ScrollView: host('ScrollView'),
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(effect, [effect]);
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef(({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return <View {...props}>{children}</View>;
  });
  MapView.displayName = 'MapView';

  return {
    __esModule: true,
    default: MapView,
    Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Polyline: () => null,
    PROVIDER_DEFAULT: null,
  };
});

jest.mock('@/components/VehicleMapMarker', () => ({
  VehicleMapMarker: ({ compact }: { compact?: boolean }) => {
    const { Text } = require('react-native');
    return <Text>{compact ? 'Compact vehicle marker' : 'Vehicle marker'}</Text>;
  },
}));

const user: User = {
  id: 'driver-1',
  name: 'Test Driver',
  phone: '+250788000000',
  mode: 'driver',
  isDriver: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const baseProfile: DriverProfile = {
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

const activeEntitlement = activatePackage(
  EMPTY_DRIVER_ENTITLEMENT,
  'launch_starter',
  '2026-01-01T00:00:00.000Z',
).entitlement;

function completedRide(overrides: Partial<Ride>): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 2,
    duration: 10,
    suggestedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:20:00.000Z',
    ...overrides,
  };
}

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

function DashboardProviders() {
  return (
    <AuthProvider>
      <DriverEntitlementProvider>
        <RideProvider>
          <View testID="dashboard-root">
            <DriverDashboard />
          </View>
        </RideProvider>
      </DriverEntitlementProvider>
    </AuthProvider>
  );
}

async function seedDriverState({
  profile = baseProfile,
  withCredits = true,
}: {
  profile?: DriverProfile;
  withCredits?: boolean;
} = {}) {
  await saveStoredUser(user);
  await saveStoredDriverProfile(profile);
  if (withCredits) await saveStoredDriverEntitlement(activeEntitlement);
}

describe('DriverDashboard online state', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-08T12:00:00.000Z'));
    mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('restores online from persisted driverProfile and runs request simulation only while online', async () => {
    await seedDriverState({ profile: { ...baseProfile, isOnline: true } });

    const view = render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.getByText('Go Offline')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride')).toBeTruthy());

    view.unmount();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.getByText('Go Offline')).toBeTruthy();
  });

  test('shows verified identity, zero-rating fallback, and offline status pill without a vehicle header chip', async () => {
    await seedDriverState();

    render(<DashboardProviders />);

    await waitFor(() => expect(screen.getByText('Hi, Test')).toBeTruthy());
    expect(screen.getByTestId('driver-verified-badge')).toBeTruthy();
    expect(screen.queryByText('Compact vehicle marker')).toBeNull();
    expect(screen.getByText('0.0')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByTestId('driver-identity-block').props.style).toEqual(
      expect.objectContaining({ height: 44 }),
    );
    expect(screen.getByTestId('driver-header-status').props.style).toEqual(
      expect.not.objectContaining({ backgroundColor: expect.anything() }),
    );
    expect(screen.queryByText('Moto')).toBeNull();
    expect(screen.queryByText('New Driver')).toBeNull();
    expect(screen.queryByText('Not accepting rides')).toBeNull();
    expect(screen.queryByText('Accepting rides')).toBeNull();
  });

  test('shows the persisted average rating and online status pill', async () => {
    await seedDriverState({ profile: { ...baseProfile, isOnline: true } });
    await saveStoredDriverRatings([
      rating({ id: 'rating-1', rideId: 'ride-1', stars: 5 }),
      rating({ id: 'rating-2', rideId: 'ride-2', stars: 4, idempotencyKey: 'driver-rating:completed-ride:ride-2' }),
    ]);

    render(<DashboardProviders />);

    await waitFor(() => expect(screen.getByText('4.5')).toBeTruthy());
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.queryByText('Accepting rides')).toBeNull();
    expect(screen.queryByText('New Driver')).toBeNull();
  });

  test('persists online toggles and clears pending request timers when going offline', async () => {
    await seedDriverState();
    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Balance')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: true }),
    });

    fireEvent.press(screen.getByText('Go Offline'));
    await waitFor(() => expect(screen.getByText('Offline')).toBeTruthy());
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });

    act(() => {
      jest.advanceTimersByTime(6_000);
    });
    expect(screen.queryByText('Incoming Ride')).toBeNull();
  });

  test('does not allow pending drivers or approved drivers with zero credits to go online', async () => {
    await seedDriverState({
      profile: { ...baseProfile, verificationStatus: 'pending_review', isVerified: false },
    });
    const pendingView = render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Balance')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    expect(screen.getByText('Offline')).toBeTruthy();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });

    pendingView.unmount();
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    await seedDriverState({ withCredits: false });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('No Balance')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    expect(router.push).toHaveBeenCalledWith('/driver-packages');
    expect(screen.getByText('Offline')).toBeTruthy();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });
  });

  test('shows real activity-backed earnings, completed rides, and remaining credits', async () => {
    await seedDriverState({
      profile: { ...baseProfile, completedRides: 4, dailyRides: 2, earningsTotal: 20000 },
    });
    await saveSecureStorage(STORAGE_KEYS.rideHistory, [
      completedRide({ id: 'today-real-fare', driverId: 'driver-1', agreedFare: 3500 }),
      completedRide({ id: 'today-no-agreed-fare', driverId: 'driver-1', agreedFare: undefined }),
      completedRide({
        id: 'yesterday-real-fare',
        driverId: 'driver-1',
        agreedFare: 9900,
        createdAt: '2026-06-07T09:00:00.000Z',
        completedAt: '2026-06-07T09:20:00.000Z',
      }),
    ]);

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Earnings')).toBeTruthy());

    expect(screen.getByText('3,500 RWF')).toBeTruthy();
    expect(screen.getByText('Trips')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('Bonus')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText('13,400 RWF')).toBeNull();
    expect(screen.queryByText('Acceptance Rate')).toBeNull();
    expect(screen.queryByText('rate')).toBeNull();
  });

  test('does not count customer history as driver activity earnings', async () => {
    await seedDriverState();
    await saveSecureStorage(STORAGE_KEYS.rideHistory, [
      completedRide({ id: 'customer-history', customerId: 'driver-1', agreedFare: 3500 }),
      completedRide({ id: 'other-driver-history', driverId: 'driver-2', agreedFare: 4200 }),
      completedRide({ id: 'legacy-history', agreedFare: 1900 }),
    ]);

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Earnings')).toBeTruthy());

    expect(screen.getByText('0 RWF')).toBeTruthy();
    expect(screen.queryByText('3,500 RWF')).toBeNull();
    expect(screen.queryByText('4,200 RWF')).toBeNull();
    expect(screen.queryByText('1,900 RWF')).toBeNull();
  });

  test('shows zero activity clearly when no completed ride data exists', async () => {
    await seedDriverState();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Earnings')).toBeTruthy());

    expect(screen.getByText('0 RWF')).toBeTruthy();
    expect(screen.getByText('Trips')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
  });

  test('keeps edge-to-edge status card content below a notch safe area', async () => {
    mockSafeAreaInsets = { top: 44, right: 0, bottom: 0, left: 0 };
    await seedDriverState();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Hi, Test')).toBeTruthy());

    expect(screen.getByTestId('driver-status-card').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paddingTop: 58 }),
      ]),
    );
  });

  test('shows inline no-credit warning and tappable advertiser carousel on the dashboard', async () => {
    await seedDriverState({ withCredits: false });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('No Balance')).toBeTruthy());

    expect(screen.getByText('Choose a package to start receiving ride requests.')).toBeTruthy();
    expect(screen.getByText('View Packages')).toBeTruthy();
    expect(screen.getByTestId('dashboard-ad-airtel')).toBeTruthy();
    expect(screen.getByTestId('dashboard-ad-jibu')).toBeTruthy();
    expect(screen.getByTestId('dashboard-ad-bralirwa')).toBeTruthy();

    fireEvent.press(screen.getByText('View Packages'));
    expect(router.push).toHaveBeenCalledWith('/driver-packages');

    fireEvent.press(screen.getByTestId('dashboard-ad-airtel'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.airtel.co.rw/');

    fireEvent.press(screen.getByTestId('dashboard-ad-bralirwa'));
    expect(Linking.openURL).toHaveBeenCalledWith('http://www.bralirwa.com/');
  });

  test('requires sliding the profile avatar far enough to switch to customer mode', async () => {
    await seedDriverState();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Slide to Customer')).toBeTruthy());

    const dragHandle = screen.getByTestId('switch-mode-avatar-drag-handle');

    fireEvent(dragHandle, 'responderGrant', {}, { dx: 0, dy: 0 });
    fireEvent(dragHandle, 'responderMove', {}, { dx: 50, dy: 0 });
    fireEvent(dragHandle, 'responderRelease', {}, { dx: 50, dy: 0 });

    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)');

    fireEvent(dragHandle, 'responderGrant', {}, { dx: 0, dy: 0 });
    fireEvent(dragHandle, 'responderMove', {}, { dx: 120, dy: 0 });
    fireEvent(dragHandle, 'responderRelease', {}, { dx: 120, dy: 0 });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  test('keeps accessibility activation fallback for switching to customer mode', async () => {
    await seedDriverState();

    render(<DashboardProviders />);
    const switchCta = await screen.findByLabelText('Slide to switch to customer mode');

    fireEvent(switchCta, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });
});
