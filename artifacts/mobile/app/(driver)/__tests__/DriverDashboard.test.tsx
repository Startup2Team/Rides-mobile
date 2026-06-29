import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import type { DriverProfile, DriverVehicleProfile, Ride, User, VehicleType } from '@/types';
import DriverDashboard from '../index';

let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const mockAlert = jest.fn();
const mockReact = React;

type ScheduledHandle = {
  id: number;
  kind: 'timeout' | 'interval';
  delay: number;
  remaining: number;
  token: number;
  active: boolean;
  callback: () => void;
};

function createScreenTimerManager() {
  let session = 0;
  let nextId = 0;
  const handles = new Map<number, ScheduledHandle>();

  const clearHandle = (handle: ScheduledHandle | null) => {
    if (!handle) return;
    handles.delete(handle.id);
    handle.active = false;
  };

  const clearAll = () => {
    handles.clear();
  };

  const startSession = () => {
    clearAll();
    session += 1;
    return session;
  };

  const scheduleTimeout = (callback: () => void, delayMs: number, token = session) => {
    const handle: ScheduledHandle = {
      id: ++nextId,
      kind: 'timeout',
      delay: delayMs,
      remaining: delayMs,
      token,
      active: true,
      callback,
    };
    handles.set(handle.id, handle);
    return handle;
  };

  const scheduleInterval = (callback: () => void, delayMs: number, token = session) => {
    const handle: ScheduledHandle = {
      id: ++nextId,
      kind: 'interval',
      delay: delayMs,
      remaining: delayMs,
      token,
      active: true,
      callback,
    };
    handles.set(handle.id, handle);
    return handle;
  };

  const advance = (ms: number) => {
    let remainingMs = ms;
    while (remainingMs > 0) {
      const activeHandles = [...handles.values()].filter(handle => handle.active && handle.token === session);
      if (activeHandles.length === 0) break;
      const step = Math.min(remainingMs, ...activeHandles.map(handle => handle.remaining));
      activeHandles.forEach(handle => {
        handle.remaining -= step;
      });
      activeHandles
        .filter(handle => handle.remaining <= 0)
        .sort((a, b) => a.id - b.id)
        .forEach(handle => {
          if (!handle.active || handle.token !== session) return;
          if (handle.kind === 'timeout') {
            clearHandle(handle);
            handle.callback();
            return;
          }
          handle.callback();
          handle.remaining = handle.delay;
        });
      remainingMs -= step;
    }
  };

  return {
    startSession,
    endSession: startSession,
    currentSession: () => session,
    isActive: (token: number) => token === session,
    scheduleTimeout,
    scheduleInterval,
    clearTimeout: clearHandle,
    clearInterval: clearHandle,
    clearAll,
    advance,
  };
}

const mockScreenTimers = createScreenTimerManager();

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
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Image: host('Image'),
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    Modal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) => (visible ? <>{children}</> : null),
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
  useFocusEffect: () => undefined,
}));

jest.mock('@/hooks/useScreenTimerManager', () => ({
  useScreenTimerManager: () => mockScreenTimers,
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name, ...props }: { name: string }) => <Text {...props}>{name}</Text>;
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: object) => <View {...props} /> };
});

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
    return mockReact.createElement('Text', null, compact ? 'Compact vehicle marker' : 'Vehicle marker');
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
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DriverEntitlementProvider>
          <RideProvider>
            <View testID="dashboard-root">
              <DriverDashboard />
            </View>
          </RideProvider>
        </DriverEntitlementProvider>
      </AuthProvider>
    </QueryClientProvider>
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

function makeVehicle(id: string, vehicleType: VehicleType, plateNumber: string, status: DriverVehicleProfile['status'] = 'approved') {
  return {
    id,
    vehicleType,
    status,
    plateNumber,
    licenseNumber: '1234567890123456',
    brand: vehicleType === 'cab' ? 'Toyota' : 'Yamaha',
    model: vehicleType === 'cab' ? 'Corolla' : 'BWS',
    manufactureYear: 2020,
    submittedAt: '2026-06-08T09:00:00.000Z',
  } satisfies DriverVehicleProfile;
}

function makeVehicleEntitlement(vehicle: DriverVehicleProfile, rides: number, bonusRides = 0) {
  return {
    vehicleId: vehicle.id,
    vehicleType: vehicle.vehicleType,
    activePackageId: null,
    remainingRideCredits: rides,
    remainingBonusRides: bonusRides,
    activations: [],
    creditTransactions: [],
    purchaseHistory: [],
    updatedAt: '2026-06-08T09:00:00.000Z',
    authority: 'local_prototype' as const,
  };
}

describe('DriverDashboard online state', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-08T12:00:00.000Z'));
    mockScreenTimers.clearAll();
    mockScreenTimers.startSession();
    mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    mockAlert.mockImplementation((_title, _message, buttons: Array<{ onPress?: () => void }> = []) => {
      buttons[0]?.onPress?.();
    });
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = String(args[0]);
      if (message.includes('react-test-renderer is deprecated')) return;
      if (message.includes('not wrapped in act(...)')) return;
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
      mockScreenTimers.advance(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride Request')).toBeTruthy());
    expect(screen.getByText('Amina K.')).toBeTruthy();
    expect(screen.getByText('4.7')).toBeTruthy();
    expect(screen.getAllByText('Pickup').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    expect(screen.getByText('Destination')).toBeTruthy();
    expect(screen.getByText('Kigali City Tower')).toBeTruthy();
    expect(screen.getAllByText('Pickup').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Trip Distance')).toBeTruthy();
    expect(screen.getByText('4.46 km')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('~18 min')).toBeTruthy();
    expect(screen.queryByText('Accept to negotiate the fare.')).toBeNull();
    expect(screen.queryByText('Suggested Fare')).toBeNull();
    expect(screen.queryByText('Estimated Fare')).toBeNull();
    expect(screen.queryByText('Platform Fare')).toBeNull();
    expect(screen.queryByText('Fixed Price')).toBeNull();

    view.unmount();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.getByText('Go Offline')).toBeTruthy();
  });

  test('shows verified identity, zero-rating fallback, and offline status', async () => {
    await seedDriverState();

    render(<DashboardProviders />);

    await waitFor(() => expect(screen.getByText('Test')).toBeTruthy());
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

    await waitFor(() => expect(screen.getByText('0.0')).toBeTruthy());
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.queryByText('Accepting rides')).toBeNull();
    expect(screen.queryByText('New Driver')).toBeNull();
  });

  test('persists online toggles and clears pending request timers when going offline', async () => {
    await seedDriverState();
    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Rides')).toBeTruthy());

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
      mockScreenTimers.advance(6_000);
    });
    expect(screen.queryByText('Incoming Ride')).toBeNull();
  });

  test('accepting an incoming request routes to driver negotiation and clears the sheet', async () => {
    await seedDriverState({ profile: { ...baseProfile, isOnline: true } });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    act(() => {
      mockScreenTimers.advance(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride Request')).toBeTruthy());

    fireEvent.press(screen.getByText('Accept'));

    expect(router.push).toHaveBeenCalledWith('/driver-negotiation');
    await waitFor(() => expect(screen.queryByText('Incoming Ride Request')).toBeNull());
  });

  test('declining an incoming request clears it', async () => {
    await seedDriverState({ profile: { ...baseProfile, isOnline: true } });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    act(() => {
      mockScreenTimers.advance(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride Request')).toBeTruthy());

    fireEvent.press(screen.getByText('Decline'));

    await waitFor(() => expect(screen.queryByText('Incoming Ride Request')).toBeNull());
  });

  test('countdown expiry clears the incoming request', async () => {
    await seedDriverState({ profile: { ...baseProfile, isOnline: true } });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    act(() => {
      mockScreenTimers.advance(5_000);
    });
    await waitFor(() => expect(screen.getByText('Incoming Ride Request')).toBeTruthy());

    act(() => {
      mockScreenTimers.advance(16_000);
    });

    expect(screen.queryByText('Incoming Ride Request')).toBeNull();
  }, 10_000);

  test('does not allow pending drivers or approved drivers with zero credits to go online', async () => {
    await seedDriverState({
      profile: { ...baseProfile, verificationStatus: 'pending_review', isVerified: false },
    });
    const pendingView = render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Rides')).toBeTruthy());

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
    await waitFor(() => expect(screen.getByText('No Rides')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));
    expect(screen.getByText('Offline')).toBeTruthy();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });
  });

  test('auto-selects the only approved vehicle when going online', async () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'RAD 001 A');
    await seedDriverState({
      profile: {
        ...baseProfile,
        vehicles: [vehicle],
        activeVehicle: { vehicleId: null },
      },
    });
    await saveStoredDriverEntitlement({
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleEntitlements: [makeVehicleEntitlement(vehicle, 8, 2)],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Go Online')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.queryByText('Select vehicle for this session')).toBeNull();
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({
        isOnline: true,
        activeVehicle: expect.objectContaining({ vehicleId: vehicle.id }),
      }),
    });
  });

  test('blocks going online when the selected vehicle license is expired and opens the update flow', async () => {
    await seedDriverState({
      profile: {
        ...baseProfile,
        licenseExpiryDate: '07/06/2026',
      },
    });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Go Online')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));

    await waitFor(() => expect(screen.getByText('Driver License Expired')).toBeTruthy());
    expect(screen.getByText('Your driver license has expired. Update your driver license documents to continue receiving ride requests.')).toBeTruthy();
    expect(screen.getByText('Update License')).toBeTruthy();
    expect(screen.getByText('Not Now')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();

    fireEvent.press(screen.getByText('Update License'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/driver-vehicle-details',
      params: {
        vehicleId: expect.any(String),
        updateDocument: 'license',
      },
    });

    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({ isOnline: false }),
    });
  });

  test('allows online when insurance or authorization are expired but license is valid', async () => {
    await seedDriverState({
      profile: {
        ...baseProfile,
        licenseExpiryDate: '01/01/2030',
        insuranceExpiryDate: '07/06/2026',
        authorizationExpiryDate: '07/06/2026',
      },
    });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Go Online')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    expect(screen.queryByText('Compliance')).toBeNull();
    expect(screen.queryByText('⚠ Insurance expired. Update recommended.')).toBeNull();
    expect(screen.queryByText('⚠ Authorization expired. Update recommended.')).toBeNull();
  });

  test('shows a vehicle selection sheet when multiple approved vehicles exist', async () => {
    const primary = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'RAD 001 A');
    const secondary = makeVehicle('driver-vehicle:cab:rac-002-a', 'cab', 'RAC 002 A');
    await seedDriverState({
      profile: {
        ...baseProfile,
        vehicles: [primary, secondary],
        activeVehicle: { vehicleId: primary.id },
      },
    });
    await saveStoredDriverEntitlement({
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleEntitlements: [
        makeVehicleEntitlement(primary, 12, 3),
        makeVehicleEntitlement(secondary, 4, 1),
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Go Online')).toBeTruthy());

    fireEvent.press(screen.getByText('Go Online'));

    await waitFor(() => expect(screen.getByText('Select vehicle for this session')).toBeTruthy());
    expect(screen.getByText('Yamaha BWS')).toBeTruthy();
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.queryByText('Under Review')).toBeNull();

    fireEvent.press(screen.getByText('Toyota Corolla'));

    await waitFor(() => expect(screen.getByText('Online')).toBeTruthy());
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: expect.objectContaining({
        isOnline: true,
        activeVehicle: expect.objectContaining({ vehicleId: secondary.id }),
      }),
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
    expect(screen.getByText('Rides')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('Bonus Rides')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText(/credits/i)).toBeNull();
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
    expect(screen.getByText('Rides')).toBeTruthy();
  });

  test('keeps edge-to-edge status card content below a notch safe area', async () => {
    mockSafeAreaInsets = { top: 44, right: 0, bottom: 0, left: 0 };
    await seedDriverState();

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('Test')).toBeTruthy());

    expect(screen.getByTestId('driver-status-card').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paddingTop: 58 }),
      ]),
    );
  });

  test('shows inline no-credit warning and tappable advertiser carousel on the dashboard', async () => {
    await seedDriverState({ withCredits: false });

    render(<DashboardProviders />);
    await waitFor(() => expect(screen.getByText('No Rides')).toBeTruthy());

    expect(screen.getByText('Choose a package to start receiving ride requests.')).toBeTruthy();
    expect(screen.getByText('View Packages')).toBeTruthy();
    expect(screen.queryByText(/credits/i)).toBeNull();
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
