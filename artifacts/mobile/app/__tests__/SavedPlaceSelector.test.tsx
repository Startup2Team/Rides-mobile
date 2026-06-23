import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import SavedPlaceSelectorScreen from '../saved-place-selector';

const mockBack = jest.fn();
const mockPersist = jest.fn();
const mockSetText = jest.fn();
const mockClearText = jest.fn();
const mockHandleTextChange = jest.fn();
const mockAlert = jest.fn();
const mockBuildTypedLocation = jest.fn(() => ({
  latitude: -1.94,
  longitude: 30.06,
  address: 'Typed address',
  locationType: 'generic',
}));

let mockParams: Record<string, string> = { label: 'Home', mode: 'add' };
let mockSavedPlaces: any[] = [];
let mockSearch = {
  text: '',
  loading: false,
  suggestions: [] as {
    id: string;
    title: string;
    subtitle: string;
    place_name: string;
    coords: { latitude: number; longitude: number };
  }[],
};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Alert: { alert: (...args: any[]) => mockAlert(...args) },
    Keyboard: { dismiss: jest.fn() },
    Platform: { OS: 'android' },
    StyleSheet: { absoluteFill: {}, create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([])),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: -1.97, longitude: 30.10 } })),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => <View {...props} />, PROVIDER_DEFAULT: 'default' };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('@/components/GlassHeader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    GlassHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    useGlassHeaderMetrics: () => ({ contentTop: 0 }),
  };
});

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScrollView: (props: { children: React.ReactNode }) => <View>{props.children}</View> };
});

jest.mock('@/components/home/MapPickerOverlay', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    MapPickerOverlay: ({ onConfirm, savedLocationConfirmTitle, savedLocationHint }: {
      onConfirm: () => void;
      savedLocationConfirmTitle?: string;
      savedLocationHint?: string;
    }) => (
      <View>
        <Text>{savedLocationHint}</Text>
        <TouchableOpacity testID="confirm-map-picker" onPress={onConfirm}>
          <Text>{savedLocationConfirmTitle}</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/components/AppButton', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return { AppButton: ({ onPress, title }: { onPress: () => void; title: string }) => <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity> };
});

jest.mock('@/context/SavedLocationsContext', () => ({
  useSavedLocations: () => ({
    savedPlaces: mockSavedPlaces,
    persistSavedPlaces: (...args: unknown[]) => mockPersist(...args),
  }),
}));

jest.mock('@/hooks/home/useLocationSearch', () => ({
  useLocationSearch: () => ({
    ...mockSearch,
    buildTypedLocation: mockBuildTypedLocation,
    clearText: mockClearText,
    handleTextChange: mockHandleTextChange,
    setText: mockSetText,
  }),
}));

describe('SavedPlaceSelectorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { label: 'Home', mode: 'add' };
    mockSavedPlaces = [];
    mockSearch = { text: '', loading: false, suggestions: [] };
  });

  test('offers address search and map selection in add mode', () => {
    render(<SavedPlaceSelectorScreen />);

    expect(screen.getByText('Add Home')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search home address')).toBeTruthy();
    fireEvent.press(screen.getByText('Set location on map'));
    expect(screen.getByText('Drag the map to set your home location')).toBeTruthy();
    expect(screen.getByText('Confirm Home Location')).toBeTruthy();
  });

  test('saves a selected search suggestion in add mode (creates new place)', async () => {
    mockSearch = {
      text: 'Kigali',
      loading: false,
      suggestions: [{
        id: 'place-1',
        title: 'Kigali Heights',
        subtitle: 'Kigali',
        place_name: 'Kigali Heights, Kigali',
        coords: { latitude: -1.95, longitude: 30.09 },
      }],
    };
    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Kigali Heights'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Home', address: 'Kigali Heights, Kigali' }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('prefills address and coords if provided as search params', () => {
    mockParams = {
      mode: 'add',
      label: 'Other',
      initialAddress: 'Kigali Marriott',
      initialLatitude: '-1.96',
      initialLongitude: '30.08',
    };

    render(<SavedPlaceSelectorScreen />);

    expect(screen.getByPlaceholderText('Place name')).toBeTruthy();
    expect(mockSetText).toHaveBeenCalledWith('Kigali Marriott');
  });

  test('saves and updates in edit mode without creating duplicate', async () => {
    mockParams = {
      mode: 'edit',
      savedPlaceId: 'place-home',
    };
    mockSavedPlaces = [{
      id: 'place-home',
      label: 'Home',
      address: 'KG 10 Street',
      latitude: -1.94,
      longitude: 30.06,
    }];
    mockSearch = {
      text: 'KG 10 Street',
      loading: false,
      suggestions: [{
        id: 'place-home-new',
        title: 'KG 10 Street New Address',
        subtitle: 'Kigali',
        place_name: 'KG 10 Street New Address, Kigali',
        coords: { latitude: -1.945, longitude: 30.065 },
      }],
    };

    render(<SavedPlaceSelectorScreen />);

    expect(screen.getByText('Edit Home')).toBeTruthy();

    fireEvent.press(screen.getByText('KG 10 Street New Address'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'place-home', // same ID preserved
        label: 'Home',
        address: 'KG 10 Street New Address, Kigali',
      }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('map picker works in add mode', async () => {
    mockParams = { mode: 'add', label: 'Work' };
    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));
    fireEvent.press(screen.getByTestId('confirm-map-picker'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Work', address: 'Selected location' }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('map picker works in edit mode', async () => {
    mockParams = { mode: 'edit', savedPlaceId: 'place-work' };
    mockSavedPlaces = [{
      id: 'place-work',
      label: 'Work',
      address: '123 Main St',
      latitude: -1.94,
      longitude: 30.06,
    }];

    render(<SavedPlaceSelectorScreen />);
    fireEvent.press(screen.getByText('Set location on map'));
    fireEvent.press(screen.getByTestId('confirm-map-picker'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'place-work', label: 'Work' }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('delete flow triggers confirmation and deletes saved place', async () => {
    mockParams = { mode: 'edit', savedPlaceId: 'place-home' };
    mockSavedPlaces = [{
      id: 'place-home',
      label: 'Home',
      address: 'KG 10 Street',
      latitude: -1.94,
      longitude: 30.06,
    }];

    render(<SavedPlaceSelectorScreen />);

    const deleteBtn = screen.getByText('Delete Saved Place');
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(deleteBtn);

    expect(mockAlert).toHaveBeenCalledWith(
      'Delete "Home"?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      ])
    );

    // Call the delete handler
    const deleteHandler = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Delete').onPress;
    await deleteHandler();

    expect(mockPersist).toHaveBeenCalledWith([]);
    expect(mockBack).toHaveBeenCalled();
  });
});
