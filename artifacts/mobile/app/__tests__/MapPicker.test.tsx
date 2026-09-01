import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

// Simulates AppMap's imperative handle. Defaults to rejecting — the same as
// a real map that hasn't finished measuring yet — so existing tests exercise
// the state-fallback path in resolveCenterCoordinate exactly as before.
// Individual tests override this to simulate a fresh, resolvable center.
const mockCoordinateForPoint = jest.fn<
  Promise<{ latitude: number; longitude: number }>,
  [{ x: number; y: number }]
>(() => Promise.reject(new Error('not measured yet')));

jest.mock('@/components/home/MapPickerOverlay', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    MapPickerOverlay: ({ target, mapRef, onLayout, onConfirm, onClose, savedLocationHint, savedLocationConfirmTitle }: any) => {
      React.useEffect(() => {
        mapRef.current = { coordinateForPoint: (point: { x: number; y: number }) => mockCoordinateForPoint(point) };
        onLayout(390, 780);
        // Run once on mount only — `onLayout`/`mapRef` are recreated on every
        // parent render, and re-firing `onLayout` each time would loop state updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <View>
          {savedLocationHint ? <Text>{savedLocationHint}</Text> : null}
          <TouchableOpacity onPress={onConfirm}>
            <Text>{savedLocationConfirmTitle || (target === 'pickup' ? 'Confirm Pickup Location' : target === 'dropoff' ? 'Confirm Drop Off Location' : 'Confirm Saved Location')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text>Back</Text>
          </TouchableOpacity>
        </View>
      );
    },
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

  test('confirming a booking pickup updates RideContext and closes', async () => {
    mockParams = {
      target: 'pickup',
      mode: 'booking',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Map Pickup',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Pickup Location'));

    // Confirm now resolves the center coordinate (async — see
    // resolveCenterCoordinate in map-picker.tsx) before committing, so the
    // effects land a tick after the press.
    await waitFor(() => expect(mockBack).toHaveBeenCalled());

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
  });

  test('confirming a booking dropoff updates RideContext and closes', async () => {
    mockParams = {
      target: 'dropoff',
      mode: 'booking',
      initialLatitude: '-1.96',
      initialLongitude: '30.08',
      initialAddress: 'Map Dropoff',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Drop Off Location'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

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
  });

  test('confirming a saved-place add returns a draft selection', async () => {
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

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

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
  });

  test('confirming a saved-place edit returns the matching draft selection', async () => {
    mockParams = {
      target: 'saved-place',
      mode: 'saved-place-edit',
      sessionId: 'session-2',
      savedPlaceId: 'place-1',
      label: 'Work',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Edited location',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Confirm Work Location'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    expect(mockSetResult).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-2',
      mode: 'saved-place-edit',
      savedPlaceId: 'place-1',
      address: 'Edited location',
      latitude: -1.95,
      longitude: 30.07,
      createdAt: expect.any(Number),
      target: 'saved-place',
    }));
  });

  test('cancel closes the map picker without writing a result', () => {
    mockParams = {
      target: 'pickup',
      mode: 'booking',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Map Pickup',
    };

    render(<MapPickerScreen />);

    fireEvent.press(screen.getByText('Back'));

    expect(mockSetResult).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  test('confirm resolves the coordinate under the pin fresh, not stale React state', async () => {
    mockParams = {
      target: 'pickup',
      mode: 'booking',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Map Pickup',
    };
    // First call is the screen's own background resync on mount — resolves
    // to the same coordinate the screen already has (a no-op). Second call
    // is the one `confirmSelection` makes directly, at press time, and
    // reports a coordinate the map has since moved to. Confirm must use the
    // second (fresh) value, not whatever `mapCoords` state last settled on.
    mockCoordinateForPoint
      .mockResolvedValueOnce({ latitude: -1.95, longitude: 30.07 })
      .mockResolvedValueOnce({ latitude: -1.999, longitude: 30.111 });

    render(<MapPickerScreen />);
    fireEvent.press(screen.getByText('Confirm Pickup Location'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -1.999,
      longitude: 30.111,
    }));
  });

  test('confirm still resolves a coordinate when the native measurement rejects — never leaves the user stuck', async () => {
    mockParams = {
      target: 'pickup',
      mode: 'booking',
      initialLatitude: '-1.95',
      initialLongitude: '30.07',
      initialAddress: 'Map Pickup',
    };
    mockCoordinateForPoint.mockRejectedValueOnce(new Error('native measurement failed'));

    render(<MapPickerScreen />);
    fireEvent.press(screen.getByText('Confirm Pickup Location'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    // Falls back to the last known coordinate rather than hanging or dropping the confirm.
    expect(mockSetPickup).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -1.95,
      longitude: 30.07,
    }));
  });

  test('double confirm only writes one saved-place result', async () => {
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

    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    expect(mockSetResult).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
