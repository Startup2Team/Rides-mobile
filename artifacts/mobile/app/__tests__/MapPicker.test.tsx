import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import MapPickerScreen from '../map-picker';

const mockBack = jest.fn();
const mockSetPickup = jest.fn();
const mockSetDestination = jest.fn();
const mockSetDestText = jest.fn();
const mockSetBookingSelection = jest.fn();
const mockSetResult = jest.fn();

let mockParams: Record<string, string | undefined> = {};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Platform: { OS: 'android', select: (o: { android?: any; default?: any }) => o.android ?? o.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: -1.95, longitude: 30.07 } })),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = () => React.createElement('View');
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/home/MapPickerOverlay', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    MapPickerOverlay: ({ target, onConfirm, onClose, savedLocationHint, savedLocationConfirmTitle }: any) => (
      <View>
        {savedLocationHint ? <Text>{savedLocationHint}</Text> : null}
        <TouchableOpacity onPress={onConfirm}>
          <Text>{savedLocationConfirmTitle || (target === 'pickup' ? 'Confirm Pickup Location' : target === 'dropoff' ? 'Confirm Drop Off Location' : 'Confirm Saved Location')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/context/MapPickerContext', () => ({
  useMapPicker: () => ({
    setBookingSelection: (...args: unknown[]) => mockSetBookingSelection(...args),
    setResult: (...args: unknown[]) => mockSetResult(...args),
  }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup', locationType: 'precise' },
    destination: { latitude: -1.96, longitude: 30.08, address: 'Dropoff', locationType: 'precise' },
    setPickup: (...args: unknown[]) => mockSetPickup(...args),
    setDestination: (...args: unknown[]) => mockSetDestination(...args),
    setDestText: (...args: unknown[]) => mockSetDestText(...args),
  }),
}));

jest.mock('@/context/SavedLocationsContext', () => ({
  useSavedLocations: () => ({
    savedPlaces: [
      { id: 'place-1', label: 'Work', latitude: -1.95, longitude: 30.07, address: 'Existing work' },
    ],
  }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#07f',
  }),
}));

describe('MapPickerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  test('renders a safe error state for invalid params', () => {
    render(<MapPickerScreen />);

    expect(screen.getByText('Map picker unavailable')).toBeTruthy();
    fireEvent.press(screen.getByText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('confirming a booking pickup updates RideContext and closes', () => {
    mockParams = {
      target: 'pickup',
      mode: 'booking',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Map Pickup',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Pickup Location'));

    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -1.95,
      longitude: 30.07,
      address: 'Map Pickup',
      locationType: 'precise',
    }));
    expect(mockSetBookingSelection).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'booking',
      target: 'pickup',
    }));
    expect(mockBack).toHaveBeenCalled();
  });

  test('confirming a booking dropoff updates RideContext and closes', () => {
    mockParams = {
      target: 'dropoff',
      mode: 'booking',
      initialLatitude: '-1.96',
      initialLongitude: '30.08',
      initialAddress: 'Map Dropoff',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Drop Off Location'));

    expect(mockSetDestText).toHaveBeenCalledWith('Map Dropoff');
    expect(mockSetDestination).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -1.96,
      longitude: 30.08,
      address: 'Map Dropoff',
      locationType: 'precise',
    }));
    expect(mockSetBookingSelection).toHaveBeenCalledWith(expect.objectContaining({
      flow: 'booking',
      target: 'dropoff',
    }));
    expect(mockBack).toHaveBeenCalled();
  });

  test('confirming a saved-place add returns a draft selection', () => {
    mockParams = {
      target: 'saved-place',
      mode: 'saved-place-add',
      sessionId: 'session-1',
      label: 'Home',
      initialLatitude: '-1.97',
      initialLongitude: '30.09',
      initialAddress: 'Draft location',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Home Location'));

    expect(mockSetResult).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      mode: 'saved-place-add',
      savedPlaceId: undefined,
      address: 'Draft location',
      latitude: -1.97,
      longitude: 30.09,
      createdAt: expect.any(Number),
      target: 'saved-place',
    }));
    expect(mockBack).toHaveBeenCalled();
  });

  test('double confirm only writes one saved-place result', () => {
    mockParams = {
      target: 'saved-place',
      mode: 'saved-place-add',
      sessionId: 'session-1',
      label: 'Home',
      initialLatitude: '-1.97',
      initialLongitude: '30.09',
      initialAddress: 'Draft location',
    };

    render(<MapPickerScreen />);

    const confirmButton = screen.getByText('Confirm Home Location');
    fireEvent.press(confirmButton);
    fireEvent.press(confirmButton);

    expect(mockSetResult).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
