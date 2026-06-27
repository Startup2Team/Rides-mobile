jest.mock('@/constants/savedLocations', () => ({
  MAX_SAVED_LOCATIONS: 20,
}));

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SavedLocationsProvider, useSavedLocations } from '../SavedLocationsContext';
import type { SavedLocation } from '@/domains/saved-locations';

const mockListSavedLocations = jest.fn();
const mockReplaceSavedLocations = jest.fn();

jest.mock('@/domains/saved-locations/repository', () => ({
  savedLocationsRepository: {
    listSavedLocations: (...args: unknown[]) => mockListSavedLocations(...args),
    replaceSavedLocations: (...args: unknown[]) => mockReplaceSavedLocations(...args),
    saveLocation: jest.fn(),
    removeSavedLocation: jest.fn(),
    clearSavedLocations: jest.fn(),
  },
}));

function Consumer() {
  const { savedPlaces, loaded, saveLocation, persistSavedPlaces } = useSavedLocations();

  return (
    <View>
      <Text testID="loaded">{loaded ? 'loaded' : 'loading'}</Text>
      <Text testID="count">{String(savedPlaces.length)}</Text>
      <TouchableOpacity
        onPress={() => void saveLocation({ latitude: -1.94, longitude: 30.06, address: 'KG 10 Street', locationType: 'precise' }, 'Home')}
      >
        <Text>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void persistSavedPlaces(savedPlaces)}>
        <Text>Persist</Text>
      </TouchableOpacity>
    </View>
  );
}

describe('SavedLocationsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListSavedLocations.mockResolvedValue([
      {
        id: 'home',
        label: 'Home',
        address: 'KG 10 Street',
        latitude: -1.94,
        longitude: 30.06,
      } satisfies SavedLocation,
    ]);
    mockReplaceSavedLocations.mockResolvedValue(undefined);
  });

  test('loads saved places through the repository and preserves behavior', async () => {
    render(
      <SavedLocationsProvider>
        <Consumer />
      </SavedLocationsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').props.children).toBe('loaded'));
    expect(screen.getByTestId('count').props.children).toBe('1');
  });

  test('saveLocation still persists through the repository boundary', async () => {
    render(
      <SavedLocationsProvider>
        <Consumer />
      </SavedLocationsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').props.children).toBe('loaded'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockReplaceSavedLocations).toHaveBeenCalled());
    expect(mockReplaceSavedLocations).toHaveBeenLastCalledWith([
      expect.objectContaining({ label: 'Home', address: 'KG 10 Street' }),
    ]);
  });
});
