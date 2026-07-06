import { renderHook } from '@testing-library/react-native';
import type { SavedLocation } from '../types';
import { savedLocationsRepository, useSavedLocationActions, useSavedLocations } from '..';

const mockSavedPlaces: SavedLocation[] = [
  {
    id: 'home',
    label: 'Home',
    address: 'KG 10 Street',
    latitude: -1.94,
    longitude: 30.06,
  },
];

const mockReload = jest.fn();
const mockPersistSavedPlaces = jest.fn();
const mockSaveLocation = jest.fn();

jest.mock('@/data/repositories', () => ({
  savedLocationsRepository: {
    listSavedLocations: jest.fn(),
    replaceSavedLocations: jest.fn(),
    saveLocation: jest.fn(),
    removeSavedLocation: jest.fn(),
    clearSavedLocations: jest.fn(),
  },
}));

jest.mock('@/context/SavedLocationsContext', () => ({
  useSavedLocations: () => ({
    savedPlaces: mockSavedPlaces,
    loaded: true,
    reload: mockReload,
    persistSavedPlaces: mockPersistSavedPlaces,
    saveLocation: mockSaveLocation,
  }),
}));

describe('saved-locations domain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports the repository boundary and saved-location type', () => {
    const sampleLocation: SavedLocation = {
      id: 'work',
      label: 'Work',
      address: 'KG 15 Ave',
      latitude: -1.945,
      longitude: 30.065,
    };

    expect(savedLocationsRepository).toBeDefined();
    expect(sampleLocation.label).toBe('Work');
  });

  test('wraps the existing SavedLocationsContext for reads', () => {
    const { result } = renderHook(() => useSavedLocations());

    expect(result.current.savedPlaces).toEqual(mockSavedPlaces);
    expect(result.current.loaded).toBe(true);
    expect(result.current.reload).toBe(mockReload);
  });

  test('wraps the existing SavedLocationsContext for actions', () => {
    const { result } = renderHook(() => useSavedLocationActions());

    expect(result.current.reload).toBe(mockReload);
    expect(result.current.persistSavedPlaces).toBe(mockPersistSavedPlaces);
    expect(result.current.saveLocation).toBe(mockSaveLocation);
  });
});
