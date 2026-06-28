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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedLocationsProvider, useSavedLocations } from '../SavedLocationsContext';
import type { SavedLocation } from '@/domains/saved-locations';

const mockListSavedLocations = jest.fn();
const mockReplaceSavedLocations = jest.fn();
const mockSaveLocation = jest.fn();
const mockUseOptionalAuth = jest.fn();

jest.mock('@/domains/saved-locations/repository', () => ({
  savedLocationsRepository: {
    listSavedLocations: (...args: unknown[]) => mockListSavedLocations(...args),
    replaceSavedLocations: (...args: unknown[]) => mockReplaceSavedLocations(...args),
    saveLocation: (...args: unknown[]) => mockSaveLocation(...args),
    removeSavedLocation: jest.fn(),
    clearSavedLocations: jest.fn(),
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => mockUseOptionalAuth(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

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
    mockUseOptionalAuth.mockReturnValue({ user: { id: 'user-1' } });
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
    mockSaveLocation.mockResolvedValue(true);
  });

  test('loads saved places through the repository and preserves behavior', async () => {
    renderWithProviders(
      <SavedLocationsProvider>
        <Consumer />
      </SavedLocationsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').props.children).toBe('loaded'));
    expect(screen.getByTestId('count').props.children).toBe('1');
  });

  test('saveLocation still persists through the repository boundary', async () => {
    renderWithProviders(
      <SavedLocationsProvider>
        <Consumer />
      </SavedLocationsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loaded').props.children).toBe('loaded'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockSaveLocation).toHaveBeenCalled());
    expect(mockSaveLocation).toHaveBeenLastCalledWith(
      { latitude: -1.94, longitude: 30.06, address: 'KG 10 Street', locationType: 'precise' },
      'Home',
    );
    expect(mockReplaceSavedLocations).not.toHaveBeenCalled();
  });
});
