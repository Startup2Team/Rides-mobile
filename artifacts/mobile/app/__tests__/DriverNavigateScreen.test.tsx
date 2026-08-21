import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import DriverNavigateScreen from '../driver-navigate';
import type { Ride } from '@/types';

const mockMarkArrived = jest.fn();
const mockStartJourney = jest.fn();
const mockCompleteRide = jest.fn();
const mockCancelRide = jest.fn();
const mockShowToast = jest.fn();
const mockRecordCompletedRide = jest.fn();

let mockRide: Ride | null;
let mockDriverLocation = { latitude: -1.9366, longitude: 30.1011 };
let mockCustomerLocation: { latitude: number; longitude: number } | null = null;

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));

  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    Platform: {
      OS: 'ios',
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
    StyleSheet: {
      absoluteFill: {},
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name }: { name: string }) => {
    const { Text: MockText } = require('react-native');
    return <MockText>{name}</MockText>;
  },
  MaterialCommunityIcons: ({ name }: { name: string }) => {
    const { Text: MockText } = require('react-native');
    return <MockText>{name}</MockText>;
  },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MapView = React.forwardRef(({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
    }));
    return <View>{children}</View>;
  });
  MapView.displayName = 'MapView';

  return {
    __esModule: true,
    default: MapView,
    // Forward accessibilityLabel so tests can assert which marker rendered —
    // everything else about a real Marker (coordinate, anchor, ...) is
    // irrelevant to this screen's tests.
    Marker: ({ children, accessibilityLabel }: { children: React.ReactNode; accessibilityLabel?: string }) => {
      const { View: MockView } = require('react-native');
      return <MockView accessibilityLabel={accessibilityLabel}>{children}</MockView>;
    },
    PROVIDER_DEFAULT: null,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({
    accessibilityLabel,
    disabled,
    onPress,
    title,
  }: {
    accessibilityLabel?: string;
    disabled?: boolean;
    onPress: () => void;
    title: string;
  }) => (
    (() => {
      const { Text: MockText, TouchableOpacity: MockTouchableOpacity } = require('react-native');
      return (
        <MockTouchableOpacity
          accessibilityLabel={accessibilityLabel ?? title}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(disabled) }}
          disabled={disabled}
          onPress={onPress}
        >
          <MockText>{title}</MockText>
        </MockTouchableOpacity>
      );
    })()
  ),
}));

jest.mock('@/components/ProfileAvatarCircle', () => ({
  ProfileAvatarCircle: () => {
    const { View: MockView } = require('react-native');
    return <MockView />;
  },
}));

jest.mock('@/components/maps/LocationMapPin', () => ({
  LOCATION_MAP_PIN_ANCHOR: { x: 0.5, y: 1 },
  getLocationMapPinCenterOffset: () => ({ x: 0, y: 0 }),
  LocationMapPin: () => {
    const { View: MockView } = require('react-native');
    return <MockView />;
  },
}));

jest.mock('@/components/maps/RoutePolyline', () => ({
  RoutePolyline: () => {
    const { View: MockView } = require('react-native');
    return <MockView />;
  },
}));

jest.mock('@/components/VehicleMapMarker', () => ({
  VehicleMapMarker: () => {
    const { View: MockView } = require('react-native');
    return <MockView />;
  },
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#ffffff',
    border: '#dddddd',
    call: '#119955',
    card: '#ffffff',
    destructive: '#cc0000',
    destructiveForeground: '#ffffff',
    destructiveHex: '#cc0000',
    foreground: '#111111',
    muted: '#eeeeee',
    mutedForeground: '#666666',
    primary: '#0055cc',
    primaryForeground: '#ffffff',
    primaryHex: '#0055cc',
    star: '#ffaa00',
  }),
}));

jest.mock('@/hooks/useRoute', () => ({
  useRoute: () => ({
    route: {
      coordinates: [
        { latitude: -1.9366, longitude: 30.1011 },
        { latitude: -1.9406, longitude: 30.1011 },
      ],
      distanceMeters: 1400,
      durationSeconds: 420,
    },
    loading: false,
    error: null,
    routeKey: 'route-key',
  }),
}));

jest.mock('@/hooks/useDeviceLocation', () => ({
  useDeviceLocation: () => null,
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
      province: 'Kigali',
      district: 'Gasabo',
      sector: 'Kimironko',
      momoCode: '0781234567',
      momoProvider: 'mtn',
      dob: '1990-01-01',
      isOnline: true,
      isVerified: true,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      earningsTotal: 0,
      verificationStatus: 'approved',
    },
    recordCompletedRide: mockRecordCompletedRide,
    user: { id: 'driver-1', name: 'Driver One' },
  }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    currentRide: mockRide,
    driverLocation: mockDriverLocation,
    customerLocation: mockCustomerLocation,
    markArrived: mockMarkArrived,
    startJourney: mockStartJourney,
    completeRide: mockCompleteRide,
    cancelRide: mockCancelRide,
  }),
}));

const baseRide: Ride = {
  id: 'ride-1',
  customerId: 'customer-1',
  customerName: 'Jane Passenger',
  customerPhone: '+250700000000',
  customerRating: 4.8,
  vehicleType: 'moto',
  pickup: { latitude: -1.9365, longitude: 30.1011, address: 'Kimironko Market' },
  destination: { latitude: -1.9505, longitude: 30.0611, address: 'Kigali City Tower' },
  status: 'arriving',
  distance: 5.2,
  duration: 18,
  suggestedFare: 2500,
  agreedFare: 2800,
  negotiation: [],
  createdAt: '2026-06-17T08:00:00.000Z',
};

function setRide(status: Ride['status'], extra: Partial<Ride> = {}) {
  mockRide = { ...baseRide, status, ...extra };
}

describe('DriverNavigateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriverLocation = { latitude: -1.9366, longitude: 30.1011 };
    mockCustomerLocation = null;
    setRide('arriving');
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('pickup phase shows pickup actions and hides future actions', () => {
    render(<DriverNavigateScreen />);

    expect(screen.getByText('Jane Passenger')).toBeTruthy();
    expect(screen.getByText('Pickup')).toBeTruthy();
    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    expect(screen.getByText('Destination')).toBeTruthy();
    expect(screen.getByText('Kigali City Tower')).toBeTruthy();
    expect(screen.getByText('Distance to Pickup')).toBeTruthy();
    expect(screen.getByText('ETA to Pickup')).toBeTruthy();
    expect(screen.getByText("I've Arrived")).toBeTruthy();
    expect(screen.queryByText('Start Journey')).toBeNull();
    expect(screen.queryByText('Complete Ride')).toBeNull();
  });

  test('arrival button remains disabled outside the arrival threshold', () => {
    mockDriverLocation = { latitude: -1.9465, longitude: 30.1011 };

    render(<DriverNavigateScreen />);

    const arrivedButton = screen.getByLabelText("I've Arrived");
    expect(arrivedButton.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(arrivedButton);
    expect(mockMarkArrived).not.toHaveBeenCalled();
  });

  test('arrival button is enabled inside the arrival threshold', () => {
    render(<DriverNavigateScreen />);

    const arrivedButton = screen.getByLabelText("I've Arrived");
    expect(arrivedButton.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(arrivedButton);
    expect(mockMarkArrived).toHaveBeenCalledTimes(1);
  });

  test('pickup ETA updates from the live driver distance to pickup', () => {
    mockDriverLocation = { latitude: -1.9465, longitude: 30.1011 };
    const view = render(<DriverNavigateScreen />);

    expect(screen.getByText('ETA to Pickup')).toBeTruthy();
    expect(screen.getAllByText('6 min').length).toBeGreaterThan(0);

    mockDriverLocation = { latitude: -1.9366, longitude: 30.1011 };
    view.rerender(<DriverNavigateScreen />);

    expect(screen.getAllByText('1 min').length).toBeGreaterThan(0);
  });

  test('start journey appears only after arrival', () => {
    setRide('arrived', {
      arrivedAt: '2026-06-17T08:10:00.000Z',
      waitStartedAt: new Date().toISOString(),
    });

    render(<DriverNavigateScreen />);

    expect(screen.getByText('Customer waiting for pickup')).toBeTruthy();
    expect(screen.getByText(/Arrived at/)).toBeTruthy();
    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    expect(screen.getByText('Kigali City Tower')).toBeTruthy();
    expect(screen.getByText('Start Journey')).toBeTruthy();
    expect(screen.queryByText("I've Arrived")).toBeNull();
    expect(screen.queryByText('Complete Ride')).toBeNull();

    fireEvent.press(screen.getByText('Start Journey'));
    expect(mockStartJourney).toHaveBeenCalledTimes(1);
  });

  test('cancel ride appears only when customer wait time is over', () => {
    setRide('arrived', {
      arrivedAt: '2026-06-17T08:10:00.000Z',
      waitStartedAt: new Date(Date.now() - 181000).toISOString(),
    });

    render(<DriverNavigateScreen />);

    expect(screen.getByText('Start Journey')).toBeTruthy();
    expect(screen.getByText('Cancel Ride')).toBeTruthy();
    expect(screen.getByText(/Customer .* late/)).toBeTruthy();
  });

  test('late wait cancellation asks for confirmation and can cancel ride', () => {
    setRide('arrived', {
      arrivedAt: '2026-06-17T08:10:00.000Z',
      waitStartedAt: new Date(Date.now() - 181000).toISOString(),
    });

    render(<DriverNavigateScreen />);

    fireEvent.press(screen.getByText('Cancel Ride'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Why are you cancelling?',
      expect.stringContaining('Select a reason or keep waiting.'),
      expect.any(Array),
    );

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[1].onPress();
    expect(mockCancelRide).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('Ride cancelled: Passenger did not show up', 'info');
    const { router } = require('expo-router');
    expect(router.replace).toHaveBeenCalledWith('/(driver)');
  });

  test('complete ride appears only during active trip and asks for confirmation', () => {
    setRide('in_progress');

    render(<DriverNavigateScreen />);

    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    expect(screen.getByText('Kigali City Tower')).toBeTruthy();
    expect(screen.getByText('Distance Remaining')).toBeTruthy();
    expect(screen.getByText('ETA Remaining')).toBeTruthy();
    expect(screen.getByText('4.7 km')).toBeTruthy();
    expect(screen.getByText('24 min')).toBeTruthy();
    expect(screen.getByText('Complete Ride')).toBeTruthy();
    expect(screen.getByText('SOS')).toBeTruthy();
    expect(screen.queryByText('Call')).toBeNull();
    expect(screen.queryByText("I've Arrived")).toBeNull();
    expect(screen.queryByText('Start Journey')).toBeNull();

    fireEvent.press(screen.getByText('Complete Ride'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Complete Ride',
      'Mark this ride as completed?',
      expect.any(Array),
    );

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    act(() => { buttons[1].onPress(); });

    expect(mockCompleteRide).not.toHaveBeenCalled();
    expect(mockRecordCompletedRide).not.toHaveBeenCalled();
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/driver-ride-complete',
      params: {
        fare: '2800',
        driverId: 'driver-1',
        driverName: 'Driver One',
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        recordFare: '2800',
      },
    });
  });

  test('confetti does not appear on cancellation', () => {
    setRide('arrived', {
      arrivedAt: '2026-06-17T08:10:00.000Z',
      waitStartedAt: new Date(Date.now() - 181000).toISOString(),
    });

    render(<DriverNavigateScreen />);

    fireEvent.press(screen.getByText('Cancel Ride'));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[1].onPress();

    expect(mockCompleteRide).not.toHaveBeenCalled();
    const { router } = require('expo-router');
    expect(router.replace).toHaveBeenCalledWith('/(driver)');
    expect(router.replace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/driver-ride-complete' }));
  });

  test('active trip SOS shows emergency options', () => {
    setRide('in_progress');

    render(<DriverNavigateScreen />);

    fireEvent.press(screen.getByLabelText('Emergency SOS'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Emergency SOS',
      expect.stringContaining('Passenger: Jane Passenger'),
      expect.any(Array),
    );

    const emergencyButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    emergencyButtons[1].onPress();

    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Why are you cancelling?',
      'Choose a reason so the trip can be logged correctly.',
      expect.any(Array),
    );

    const cancelButtons = (Alert.alert as jest.Mock).mock.calls[1][2];
    cancelButtons[1].onPress();
    expect(mockCancelRide).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('Ride cancelled: Safety concern', 'info');
    const { router } = require('expo-router');
    expect(router.replace).toHaveBeenCalledWith('/(driver)');
  });

  test('shows the customer live marker through the whole trip, including in_progress', () => {
    mockCustomerLocation = { latitude: -1.94, longitude: 30.06 };
    setRide('arriving');

    const { rerender } = render(<DriverNavigateScreen />);
    expect(screen.getByLabelText('Customer, live location')).toBeTruthy();

    // Whole-trip tracking (product decision): the customer keeps publishing
    // through in_progress, so the driver must keep rendering the marker too —
    // otherwise it silently freezes at the last pre-trip fix instead of
    // disappearing or updating.
    setRide('in_progress');
    rerender(<DriverNavigateScreen />);
    expect(screen.getByLabelText('Customer, live location')).toBeTruthy();
  });

  test('does not render a customer marker until a live location has arrived', () => {
    mockCustomerLocation = null;
    setRide('arriving');

    render(<DriverNavigateScreen />);

    expect(screen.queryByLabelText('Customer, live location')).toBeNull();
    expect(screen.queryByLabelText('Customer location, may be out of date')).toBeNull();
  });
});
