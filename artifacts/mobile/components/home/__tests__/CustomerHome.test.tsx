import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CustomerHome from '../CustomerHome';

declare const __dirname: string;

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockClearRoutePreview = jest.fn();
let mockDestination: any = null;
let mockHomeMapProps: any = null;

// Mock React Native Easing / Animated timings to run immediately
jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    _value: number;
    constructor(v: number) { this._value = v; }
    setValue(v: number) { this._value = v; }
    interpolate() { return this; }
    stopAnimation(cb?: (v: number) => void) { cb?.(this._value); }
  }
  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: (val: Value, config: { toValue: number }) => ({
        start: (cb?: (result: { finished: boolean }) => void) => {
          val.setValue(config.toValue);
          cb?.({ finished: true });
        },
      }),
    },
    Easing: {
      out: (fn: (t: number) => number) => fn,
      cubic: (t: number) => t * t * t,
    },
    Alert: { alert: jest.fn() },
    Keyboard: { dismiss: jest.fn() },
    Platform: {
      OS: 'android',
      select: (o: { android?: any; default?: any }) => o.android ?? o.default,
    },
    StyleSheet: { absoluteFill: {}, create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    ScrollView: host('ScrollView'),
    ActivityIndicator: host('ActivityIndicator'),
    useColorScheme: () => 'light',
    View: host('View'),
    Modal: ({ visible, children, onRequestClose }: any) => {
      if (!visible) return null;
      return React.createElement('View', { testID: 'modal', visible, onRequestClose }, children);
    },
  };
});

// Mock hooks and contexts
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      setParams: (...args: unknown[]) => mockSetParams(...args),
    },
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
    useLocalSearchParams: () => ({}),
  };
});

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([])),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: -1.97, longitude: 30.10 } })),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} />, PROVIDER_DEFAULT: 'default' };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = () => React.createElement('View');
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('@/components/HomeTopHeader', () => ({
  HomeTopHeader: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#fff',
    primary: '#000',
    mutedForeground: '#888',
    foreground: '#000',
  }),
}));

const mockRideHistory: any[] = [];
const mockPickup = { latitude: -1.9441, longitude: 30.0619, address: 'Initial Pickup', locationType: 'generic' };
const mockDestText = '';

const mockSetPickup = jest.fn();
const mockSetDestination = jest.fn();
const mockSetDestText = jest.fn();

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    currentRide: null,
    rideHistory: mockRideHistory,
    pickup: mockPickup,
    setPickup: mockSetPickup,
    destination: mockDestination,
    setDestination: mockSetDestination,
    destText: mockDestText,
    setDestText: mockSetDestText,
    cancelledSearchDraft: null,
    restoreBookingOnHomeFocus: false,
    clearCancelledSearchDraft: jest.fn(),
    clearRestoreBookingOnHomeFocus: jest.fn(),
    loadHistory: jest.fn(),
  }),
}));

jest.mock('@/hooks/home/useRoutePreview', () => ({
  useRoutePreview: (args: any) => ({
    route: mockDestination
      ? { durationSeconds: 600, distanceMeters: 1200 }
      : null,
    routeLoading: false,
    routeFitCoords: mockDestination ? [args.pickup, mockDestination] : [],
    routeLineCoords: mockDestination ? [args.pickup, mockDestination] : [],
    shouldShowBookingRoute: Boolean(mockDestination),
    routePinPositions: {
      pickup: args.pickup,
      destination: mockDestination,
    },
    centerRouteInVisibleMap: jest.fn(),
    clearRoutePreview: mockClearRoutePreview,
  }),
}));

jest.mock('@/hooks/useSavedLocations', () => ({
  useSavedLocations: () => ({
    savedPlaces: [],
    persistSavedPlaces: jest.fn(),
    reload: jest.fn(),
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User' },
    driverProfile: null,
  }),
}));

jest.mock('@/hooks/home/useHomeLocation', () => ({
  useHomeLocation: () => ({
    currentLocationAddress: 'Initial Pickup',
    gpsLocation: { latitude: -1.9441, longitude: 30.0619, address: 'Initial Pickup', locationType: 'precise' },
    locLoading: false,
    locationError: null,
    locationStatus: 'available',
    refreshHereLocation: jest.fn(),
    startHereLocationWatch: jest.fn(),
    stopHereLocationWatch: jest.fn(),
    userLocation: { latitude: -1.9441, longitude: 30.0619 },
  }),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('../CustomerBottomSheet', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    CustomerBottomSheet: ({ homeCard, bookingCard, onCloseBooking }: any) => (
      <View>
        <TouchableOpacity onPress={() => homeCard.onContinue()}>
          <Text>Open Booking</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onCloseBooking()}>
          <Text>Close Booking</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => bookingCard.onOpenLocationSearch('pickup')}>
          <Text>Open Pickup Search</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => bookingCard.onOpenLocationSearch('dropoff')}>
          <Text>Open Dropoff Search</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => bookingCard.onUseMap('pickup', { latitude: -1.95, longitude: 30.06, address: 'Map Pickup' })}
        >
          <Text>Open Map Picker</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('../HomeMap', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    HomeMap: (props: any) => {
      mockHomeMapProps = props;
      return React.createElement(View, { testID: 'home-map' });
    },
  };
});

describe('CustomerHome Navigation Refactoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDestination = null;
    mockHomeMapProps = null;
  });

  test('obsolete bottom sheets are not rendered or imported by CustomerHome', () => {
    const fileContent = require('fs').readFileSync(
      require('path').resolve(__dirname, '../CustomerHome.tsx'),
      'utf8'
    );
    expect(fileContent).not.toContain('BottomActionSheet');
    expect(fileContent).not.toContain('SaveLocationSheet');
    expect(fileContent).not.toContain('EditSavedLocationSheet');
    expect(fileContent).not.toContain('KeyboardAwareBottomActionSheet');
    expect(fileContent).not.toContain('useEditSavedLocationKeyboard');
  });

  test('no LocationSearchOverlay Modal remains in CustomerHome', () => {
    const fileContent = require('fs').readFileSync(
      require('path').resolve(__dirname, '../CustomerHome.tsx'),
      'utf8'
    );
    expect(fileContent).not.toContain('LocationSearchOverlay');
    expect(fileContent).not.toContain('MapPickerOverlay');
    expect(fileContent).not.toContain('triggerMapPicker');
  });

  test('CustomerHome does not render any visible modal overlay', () => {
    render(<CustomerHome />);

    expect(screen.queryByTestId('modal')).toBeNull();
  });

  test('tapping pickup navigates to route-based search screen with target pickup', () => {
    render(<CustomerHome />);

    fireEvent.press(screen.getByText('Open Pickup Search'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/location-search',
      params: expect.objectContaining({
        target: 'pickup',
        source: 'booking',
        userLatitude: expect.any(String),
        userLongitude: expect.any(String),
      }),
    });
  });

  test('tapping dropoff navigates to route-based search screen with target dropoff', () => {
    render(<CustomerHome />);

    fireEvent.press(screen.getByText('Open Dropoff Search'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/location-search',
      params: expect.objectContaining({
        target: 'dropoff',
        source: 'booking',
        userLatitude: expect.any(String),
        userLongitude: expect.any(String),
      }),
    });
  });

  test('tapping map picker launches the map-picker route', () => {
    render(<CustomerHome />);

    fireEvent.press(screen.getByText('Open Map Picker'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map-picker',
      params: expect.objectContaining({
        target: 'pickup',
        mode: 'booking',
        initialLatitude: expect.any(String),
        initialLongitude: expect.any(String),
      }),
    });
  });

  test('closing booking clears booking draft state and route preview state', () => {
    render(<CustomerHome />);

    fireEvent.press(screen.getByText('Close Booking'));

    expect(mockSetDestText).toHaveBeenCalledWith('');
    expect(mockSetDestination).toHaveBeenCalledWith(null);
    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      address: 'Initial Pickup',
      locationType: 'precise',
    }));
    expect(mockClearRoutePreview).toHaveBeenCalled();
  });

  test('route preview remains connected to home map when destination is set', () => {
    mockDestination = {
      latitude: -1.95,
      longitude: 30.06,
      address: 'Downtown',
      locationType: 'precise',
    };

    render(<CustomerHome />);

    fireEvent.press(screen.getByText('Open Booking'));

    expect(screen.getByTestId('home-map')).toBeTruthy();
    expect(mockHomeMapProps.routeCoordinates).toHaveLength(2);
    expect(mockHomeMapProps.showDestination).toBe(true);
    expect(mockHomeMapProps.pickup).toEqual(expect.any(Object));
  });
});
