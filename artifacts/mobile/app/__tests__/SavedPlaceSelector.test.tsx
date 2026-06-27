import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import SavedPlaceSelectorScreen from '../saved-place-selector';
import { typography } from '@/constants/typography';

const mockPush = jest.fn();
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
let sessionCounter = 0;
let mockResult: any = null;
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
const mockCreateMapPickerSessionId = jest.fn(() => `session-${++sessionCounter}`);
function setMockResult(result: any) {
  mockResult = result;
}

function consumeMockResult(sessionId: string) {
  const current = mockResult;
  if (!current) return null;
  const isFresh = Date.now() - current.createdAt <= 5 * 60 * 1000;
  if (!isFresh || current.sessionId !== sessionId) {
    mockResult = null;
    return null;
  }
  mockResult = null;
  return current;
}

function clearMockResult(sessionId?: string) {
  if (!mockResult) return;
  if (sessionId && mockResult.sessionId !== sessionId) return;
  mockResult = null;
}

function clearMockAll() {
  mockResult = null;
}

const mockSetResult = jest.fn((result: any) => {
  setMockResult(result);
});
const mockConsumeResult = jest.fn((sessionId: string) => consumeMockResult(sessionId));
const mockClearResult = jest.fn((sessionId?: string) => clearMockResult(sessionId));
const mockClearAll = jest.fn(() => clearMockAll());

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
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
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
  const { Text, View } = require('react-native');
  return {
    GlassHeader: ({ title, right }: { title: string; right?: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {right}
      </View>
    ),
    useGlassHeaderMetrics: () => ({ contentTop: 0 }),
  };
});

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScrollView: (props: { children: React.ReactNode }) => <View>{props.children}</View> };
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

jest.mock('@/context/MapPickerContext', () => ({
  createMapPickerSessionId: () => mockCreateMapPickerSessionId(),
  useMapPicker: () => ({
    result: mockResult,
    consumeResult: (sessionId: string) => mockConsumeResult(sessionId),
    clearResult: (sessionId?: string) => mockClearResult(sessionId),
    clearAll: () => mockClearAll(),
    selection: null,
    consumeSelection: jest.fn(),
    clearSelection: jest.fn(),
    setBookingSelection: jest.fn(),
    setSavedPlaceSelection: jest.fn(),
    setResult: jest.fn(),
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

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  return style && typeof style === 'object' ? style as Record<string, unknown> : {};
}

describe('SavedPlaceSelectorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetResult.mockImplementation((result: any) => setMockResult(result));
    mockConsumeResult.mockImplementation((sessionId: string) => consumeMockResult(sessionId));
    mockClearResult.mockImplementation((sessionId?: string) => clearMockResult(sessionId));
    mockClearAll.mockImplementation(() => clearMockAll());
    mockParams = { label: 'Home', mode: 'add' };
    mockSavedPlaces = [];
    mockResult = null;
    mockSearch = { text: '', loading: false, suggestions: [] };
    sessionCounter = 0;
  });

  test('offers address search and map selection in add mode', () => {
    render(<SavedPlaceSelectorScreen />);

    expect(screen.getByText('Add Home')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search home address')).toBeTruthy();
    fireEvent.press(screen.getByText('Set location on map'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map-picker',
      params: expect.objectContaining({
        target: 'saved-place',
        mode: 'saved-place-add',
        label: 'Home',
        sessionId: 'session-1',
      }),
    });
  });

  test('uses typography tokens for the map selection label', () => {
    render(<SavedPlaceSelectorScreen />);

    const mapOptionStyle = flattenStyle(screen.getByText('Set location on map').props.style);

    expect(mapOptionStyle.fontSize).toBe(typography.h3.fontSize);
    expect(mapOptionStyle.lineHeight).toBe(typography.h3.lineHeight);
    expect(mapOptionStyle.fontFamily).toBe(typography.h3.fontFamily);
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

  test('map picker launches in edit mode with the saved place id', () => {
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

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/map-picker',
      params: expect.objectContaining({
        target: 'saved-place',
        mode: 'saved-place-edit',
        savedPlaceId: 'place-work',
        label: 'Work',
        sessionId: 'session-1',
      }),
    });
  });

  test('consumes a saved-place map result in add mode', async () => {
    mockClearResult.mockImplementation(() => {});
    mockResult = {
      sessionId: 'session-1',
      mode: 'saved-place-add',
      label: 'Work',
      savedPlaceId: undefined,
      address: 'Map selected location',
      latitude: -1.95,
      longitude: 30.07,
      createdAt: Date.now(),
      target: 'saved-place',
    };

    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({
        label: 'Home',
        address: 'Map selected location',
      }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('consumes a saved-place map result in edit mode', async () => {
    mockClearResult.mockImplementation(() => {});
    mockParams = { mode: 'edit', savedPlaceId: 'place-work' };
    mockSavedPlaces = [{
      id: 'place-work',
      label: 'Work',
      address: '123 Main St',
      latitude: -1.94,
      longitude: 30.06,
    }];
    mockResult = {
      sessionId: 'session-1',
      mode: 'saved-place-edit',
      savedPlaceId: 'place-work',
      address: 'Updated map location',
      latitude: -1.95,
      longitude: 30.07,
      createdAt: Date.now(),
      target: 'saved-place',
    };

    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));

    await waitFor(() => expect(mockPersist).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'place-work',
        label: 'Work',
        address: 'Updated map location',
      }),
    ]));
    expect(mockBack).toHaveBeenCalled();
  });

  test('ignores a stale saved-place result', async () => {
    mockResult = {
      sessionId: 'session-1',
      mode: 'saved-place-add',
      label: 'Home',
      savedPlaceId: undefined,
      address: 'Stale location',
      latitude: -1.9,
      longitude: 30.1,
      createdAt: Date.now() - (6 * 60 * 1000),
      target: 'saved-place',
    };

    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('ignores a saved-place edit result with a mismatched savedPlaceId', async () => {
    mockParams = { mode: 'edit', savedPlaceId: 'place-work' };
    mockSavedPlaces = [{
      id: 'place-work',
      label: 'Work',
      address: '123 Main St',
      latitude: -1.94,
      longitude: 30.06,
    }];
    mockResult = {
      sessionId: 'session-1',
      mode: 'saved-place-edit',
      savedPlaceId: 'different-place',
      address: 'Wrong location',
      latitude: -1.9,
      longitude: 30.1,
      createdAt: Date.now(),
      target: 'saved-place',
    };

    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('cancelled picker does not update the saved-place selector', () => {
    render(<SavedPlaceSelectorScreen />);

    fireEvent.press(screen.getByText('Set location on map'));

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/map-picker',
    }));
    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
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

    const deleteBtn = screen.queryByText('Delete Saved Place');
    expect(deleteBtn).toBeNull();

    const headerDeleteBtn = screen.getByTestId('header-delete-button');
    expect(headerDeleteBtn).toBeTruthy();

    // Verify pressing the header delete button triggers confirmation
    fireEvent.press(headerDeleteBtn);

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

  test('does not prefill custom label with "Other" when adding a new place', () => {
    mockParams = {
      mode: 'add',
      label: 'Other',
    };

    render(<SavedPlaceSelectorScreen />);

    const customLabelInput = screen.getByPlaceholderText('Place name');
    expect(customLabelInput.props.value).toBe('');
  });

  test('shows safe error state if place is not found in edit mode', () => {
    mockParams = {
      mode: 'edit',
      savedPlaceId: 'non-existent-id',
    };
    mockSavedPlaces = [];

    render(<SavedPlaceSelectorScreen />);

    expect(screen.getByText('Saved place not found or has been deleted.')).toBeTruthy();
    const backButton = screen.getByText('Go Back');
    expect(backButton).toBeTruthy();
    fireEvent.press(backButton);
    expect(mockBack).toHaveBeenCalled();
  });

  test('defaults to Other label in add mode if missing', () => {
    mockParams = {
      mode: 'add',
    };

    render(<SavedPlaceSelectorScreen />);

    // Title should contain Add Place (Other)
    expect(screen.getByText('Add Place')).toBeTruthy();
    expect(screen.getByPlaceholderText('Place name')).toBeTruthy();
  });

  test('validates that custom label is not empty on save', async () => {
    mockParams = {
      mode: 'add',
      label: 'Other',
    };
    mockSearch = {
      text: 'Kigali Marriott',
      loading: false,
      suggestions: [],
    };

    render(<SavedPlaceSelectorScreen />);

    // Custom label input is empty. Click use typed address.
    fireEvent.press(screen.getByText('Use "Kigali Marriott"'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Name this place',
      'Enter a label before saving this location.'
    );
    expect(mockPersist).not.toHaveBeenCalled();
  });

  test('cancel on delete confirmation leaves place untouched', () => {
    mockParams = { mode: 'edit', savedPlaceId: 'place-home' };
    mockSavedPlaces = [{
      id: 'place-home',
      label: 'Home',
      address: 'KG 10 Street',
      latitude: -1.94,
      longitude: 30.06,
    }];

    render(<SavedPlaceSelectorScreen />);

    const headerDeleteBtn = screen.getByTestId('header-delete-button');
    fireEvent.press(headerDeleteBtn);

    // Call the cancel handler
    const cancelHandler = mockAlert.mock.calls[0][2].find((btn: any) => btn.text === 'Cancel').onPress;
    if (cancelHandler) cancelHandler();

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
