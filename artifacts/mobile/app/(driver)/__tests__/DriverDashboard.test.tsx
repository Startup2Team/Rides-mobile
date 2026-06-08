import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { DriverEntitlementProvider } from '@/context/DriverEntitlementContext';
import { RideProvider } from '@/context/RideContext';
import { activatePackage, EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { saveStoredDriverProfile, saveStoredUser, loadStoredDriverProfile } from '@/persistence/authPersistence';
import { saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import type { DriverProfile, User } from '@/types';
import DriverDashboard from '../index';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
  }
  const animation = () => ({ start: (callback?: () => void) => callback?.() });
  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: jest.fn(animation),
      spring: jest.fn(animation),
      sequence: jest.fn(() => animation()),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: {
      absoluteFill: {},
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
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
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
  VehicleMapMarker: () => {
    const { Text } = require('react-native');
    return <Text>Vehicle marker</Text>;
  },
}));

jest.mock('@/components/driver/DriverCreditDashboardCard', () => ({
  DriverCreditDashboardCard: ({ isLoading }: { isLoading: boolean }) => {
    const { Text } = require('react-native');
    return <Text>{isLoading ? 'Credits loading' : 'Credits ready'}</Text>;
  },
}));

jest.mock('@/components/driver/DriverPackageRequiredModal', () => ({
  DriverPackageRequiredModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Package required</Text> : null;
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
    await waitFor(() => expect(screen.getByText(/Accepting rides/)).toBeTruthy());
    expect(screen.getByText('Go Offline')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride')).toBeTruthy());

    view.unmount();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText(/Accepting rides/)).toBeTruthy());
    expect(screen.getByText('Go Offline')).toBeTruthy();
  });

  test('persists online toggles and clears pending request timers when going offline', async () => {
    await seedDriverState();
    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Credits ready')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    await waitFor(() => expect(screen.getByText(/Accepting rides/)).toBeTruthy());
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: true }),
    });

    fireEvent.press(screen.getByText('Go Offline'));
    await waitFor(() => expect(screen.getByText(/Not accepting rides/)).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('Credits ready')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    expect(screen.getByText(/Not accepting rides/)).toBeTruthy();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });

    pendingView.unmount();
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    await seedDriverState({ withCredits: false });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Credits ready')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    await waitFor(() => expect(screen.getByText('Package required')).toBeTruthy());
    expect(screen.getByText(/Not accepting rides/)).toBeTruthy();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });
  });
});
