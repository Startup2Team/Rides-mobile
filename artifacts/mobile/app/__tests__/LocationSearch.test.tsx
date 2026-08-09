import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import LocationSearchScreen from '../location-search';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

const mockPersistSavedPlaces = jest.fn();
const mockShowToast = jest.fn();
const mockAlert = jest.fn();

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
    Alert: { alert: (...args: any[]) => mockAlert(...args) },
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
  };
});

let mockLocalParams = {
  target: 'pickup',
  userLatitude: '-1.9441',
  userLongitude: '30.0619',
  gpsLatitude: '-1.95',
  gpsLongitude: '30.07',
  gpsAddress: 'Gps Address',
};

// Mock hooks and contexts
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
      back: () => mockBack(),
    },
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
    useLocalSearchParams: () => mockLocalParams,
  };
});
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

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = () => React.createElement('View');
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('@/components/GlassHeader', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    GlassHeader: ({ title, onBackPress }: any) => (
      <View testID="glass-header">
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBackPress}>
          <Text>Back Button</Text>
        </TouchableOpacity>
      </View>
    ),
    useGlassHeaderMetrics: () => ({ contentTop: 10 }),
  };
});

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { ScrollView } = require('react-native');
  return { GlassScrollView: ({ children }: any) => <ScrollView>{children}</ScrollView> };
});

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

const mockSavedPlaces = [
  { id: 'place-1', label: 'Work', address: '123 Work St', latitude: 0, longitude: 0 },
];
const mockRideHistory = [
  { pickup: { latitude: 1, longitude: 2, address: 'Recent 1' }, destination: { latitude: 3, longitude: 4, address: 'Recent 2' } }
];

const mockPickup = { latitude: -1.9441, longitude: 30.0619, address: 'Initial Pickup', locationType: 'generic' };
const mockDestination = null;
const mockDestText = 'Initial Dropoff';

const mockSetPickup = jest.fn();
const mockSetDestination = jest.fn();
const mockSetDestText = jest.fn();
let mockSelection: any = null;
const mockConsumeSelection = jest.fn(() => {
  const current = mockSelection;
  mockSelection = null;
  return current;
});

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
    loadHistory: jest.fn(),
  }),
}));

jest.mock('@/hooks/useSavedLocations', () => ({
  useSavedLocations: () => ({
    savedPlaces: mockSavedPlaces,
    persistSavedPlaces: mockPersistSavedPlaces,
    reload: jest.fn(),
  }),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('@/context/MapPickerContext', () => ({
  useMapPicker: () => ({
    consumeSelection: mockConsumeSelection,
    clearSelection: jest.fn(),
    selection: mockSelection,
    setBookingSelection: jest.fn(),
    setSavedPlaceSelection: jest.fn(),
  }),
}));

// Backend location endpoints (/locations/*). Stubbed at the query-hook barrel so
// the screen renders without a QueryClient or AuthProvider.
const mockRecordRecent = jest.fn();
const mockForgetRecent = jest.fn();
let mockServerRecents: Array<{
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  useCount: number;
  lastUsedAt: string;
}> = [];
let mockLandmarks: Array<{
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  geohash6: string;
}> = [];
let mockAdminUnits: Array<{ id: string; parentId: string | null; level: string; name: string; path: string }> = [];

jest.mock('@/query/hooks', () => ({
  useLocationSuggestionsQuery: () => ({ data: undefined }),
  useLandmarksQuery: () => ({ data: mockLandmarks }),
  useRecentLocationsQuery: () => ({ data: mockServerRecents }),
  useRecordRecentLocationMutation: () => ({ mutate: mockRecordRecent }),
  useDeleteRecentLocationMutation: () => ({ mutate: mockForgetRecent }),
  useAdminUnitSearchQuery: () => ({ data: mockAdminUnits }),
  useAdminUnitsQuery: () => ({ data: [] }),
}));

// Mock geocoding service
jest.mock('@/services/geocoding', () => ({
  geocodeAddress: jest.fn(() => Promise.resolve([
    {
      id: 'sug-1',
      title: 'Kigali Center',
      place_name: 'Kigali Center, Rwanda',
      coords: { latitude: -1.94, longitude: 30.06 },
    },
  ])),
}));

describe('LocationSearchScreen Route-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSelection = null;
    mockServerRecents = [];
    mockLandmarks = [];
    mockAdminUnits = [];
    mockLocalParams = {
      target: 'pickup',
      userLatitude: '-1.9441',
      userLongitude: '30.0619',
      gpsLatitude: '-1.95',
      gpsLongitude: '30.07',
      gpsAddress: 'Gps Address',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders location search screen successfully', () => {
    render(<LocationSearchScreen />);
    expect(screen.getByTestId('glass-header')).toBeTruthy();
    expect(screen.getByText('Pickup Location')).toBeTruthy();
  });

  test('tapping back button triggers router.back()', () => {
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByText('Back Button'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('tapping choose on map opens the map-picker route with coordinates', () => {
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByText('Choose on map'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map-picker',
      params: {
        target: 'pickup',
        mode: 'booking',
        initialLatitude: '-1.95',
        initialLongitude: '30.07',
        initialAddress: 'Gps Address',
      },
    });
  });

  test('consumes a booking map selection and closes the screen', () => {
    mockSelection = {
      flow: 'booking',
      target: 'pickup',
      location: {
        latitude: -1.95,
        longitude: 30.07,
        address: 'Map selection',
        locationType: 'precise',
      },
    };

    render(<LocationSearchScreen />);

    expect(mockBack).toHaveBeenCalled();
  });

  test('entering text shows geocoding suggestions and choosing suggestion updates pickup and navigates back', async () => {
    render(<LocationSearchScreen />);

    const input = screen.getByPlaceholderText('Address, hotel, or 1 KG 185 ST');
    fireEvent.changeText(input, 'Kigali');

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByText('Kigali Center')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Kigali Center'));

    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      address: 'Kigali Center, Rwanda',
      latitude: -1.94,
      longitude: 30.06,
    }));
    expect(mockBack).toHaveBeenCalled();
  });

  test('saved locations list triggers add saved place alert', () => {
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByLabelText('Add saved place'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Add saved place',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Home' }),
        expect.objectContaining({ text: 'Work' }),
        expect.objectContaining({ text: 'School' }),
        expect.objectContaining({ text: 'Church' }),
        expect.objectContaining({ text: 'Other' }),
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      ])
    );

    const homeBtn = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Home');
    homeBtn.onPress();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/saved-place-selector',
      params: { mode: 'add', label: 'Home' },
    });
  });

  test('saved locations actions alert Edit trigger', () => {
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByLabelText('More options for Work')); // Press the saved place options item

    expect(mockAlert).toHaveBeenLastCalledWith(
      'Work',
      '123 Work St',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Edit' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    );

    const editBtn = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Edit');
    editBtn.onPress();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/saved-place-selector',
      params: { mode: 'edit', savedPlaceId: 'place-1' },
    });
  });

  test('curated backend landmarks rank above the geocoder hits', async () => {
    mockLandmarks = [
      {
        id: 'lm-1',
        name: 'Kigali Convention Centre',
        category: 'landmark',
        latitude: -1.953,
        longitude: 30.093,
        geohash6: 'kxxxxx',
      },
    ];
    render(<LocationSearchScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Address, hotel, or 1 KG 185 ST'), 'Kigali');
    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => expect(screen.getByText('Kigali Convention Centre')).toBeTruthy());
    fireEvent.press(screen.getByText('Kigali Convention Centre'));

    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      address: 'Kigali Convention Centre',
      latitude: -1.953,
      longitude: 30.093,
    }));
  });

  test('picking a drop-off records it as a server-side recent destination', async () => {
    mockLocalParams = { ...mockLocalParams, target: 'dropoff' };
    render(<LocationSearchScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Address, hotel, or 1 KG 185 ST'), 'Kigali');
    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => expect(screen.getByText('Kigali Center')).toBeTruthy());
    fireEvent.press(screen.getByText('Kigali Center'));

    expect(mockRecordRecent).toHaveBeenCalledWith({
      address: 'Kigali Center, Rwanda',
      latitude: -1.94,
      longitude: 30.06,
    });
  });

  test('server recents lead the previous-rides list and can be forgotten', () => {
    mockServerRecents = [
      {
        id: 'recent-1',
        address: 'Kimironko Market',
        latitude: -1.95,
        longitude: 30.12,
        useCount: 3,
        lastUsedAt: '2026-08-01T10:00:00Z',
      },
    ];
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByText('Previous rides'));

    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    // The device-only history stays below the server list as the offline fallback.
    expect(screen.getByText('Recent 1')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove Kimironko Market from recents'));
    const confirm = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Remove');
    confirm.onPress();

    expect(mockForgetRecent).toHaveBeenCalledWith('recent-1', expect.any(Object));
  });

  test('saved locations actions alert Delete trigger', async () => {
    render(<LocationSearchScreen />);
    fireEvent.press(screen.getByLabelText('More options for Work')); // Press the saved place options item

    const deleteBtn = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Delete');
    deleteBtn.onPress();

    expect(mockAlert).toHaveBeenLastCalledWith(
      'Delete "Work"?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      ])
    );

    const confirmDelete = mockAlert.mock.calls[1][2].find((btn: any) => btn.text === 'Delete').onPress;
    await confirmDelete();

    expect(mockPersistSavedPlaces).toHaveBeenCalledWith([]);
    expect(mockShowToast).toHaveBeenCalledWith('Location removed', 'error');
  });
});
