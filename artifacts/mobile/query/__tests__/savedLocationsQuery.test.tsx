import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { SavedLocation } from '@/domains/saved-locations';
import { savedLocationsRepository } from '@/domains/saved-locations/repository';
import {
  useAddSavedLocationMutation,
  useDeleteSavedLocationMutation,
  useEditSavedLocationMutation,
  useSavedLocationsQuery,
} from '../hooks/useSavedLocationsQuery';
import { savedLocationKeys } from '../keys';

jest.mock('@/constants/savedLocations', () => ({
  MAX_SAVED_LOCATIONS: 5,
}));

const mockListSavedLocations = jest.fn();
const mockReplaceSavedLocations = jest.fn();
const mockSaveLocation = jest.fn();
const mockRemoveSavedLocation = jest.fn();

jest.mock('@/domains/saved-locations/repository', () => ({
  savedLocationsRepository: {
    listSavedLocations: (...args: unknown[]) => mockListSavedLocations(...args),
    replaceSavedLocations: (...args: unknown[]) => mockReplaceSavedLocations(...args),
    saveLocation: (...args: unknown[]) => mockSaveLocation(...args),
    removeSavedLocation: (...args: unknown[]) => mockRemoveSavedLocation(...args),
    clearSavedLocations: jest.fn(),
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

describe('saved locations query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads saved locations by user key', async () => {
    mockListSavedLocations.mockResolvedValue([
      { id: 'home', label: 'Home', address: 'KG 10', latitude: -1.94, longitude: 30.06 } satisfies SavedLocation,
    ]);
    const { wrapper, client } = createWrapper();

    const { result } = renderHook(() => useSavedLocationsQuery('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(mockListSavedLocations).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(savedLocationKeys.list('user-1'))).toHaveLength(1);
  });

  test('optimistically adds and then invalidates saved locations', async () => {
    mockListSavedLocations.mockResolvedValue([]);
    mockSaveLocation.mockResolvedValue(true);
    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useAddSavedLocationMutation('user-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        location: { latitude: -1.94, longitude: 30.06, address: 'KG 10', locationType: 'precise' },
        label: 'Home',
      });
    });

    const cached = client.getQueryData<SavedLocation[]>(savedLocationKeys.list('user-1')) ?? [];
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ label: 'Home', address: 'KG 10' });
    expect(mockSaveLocation).toHaveBeenCalledWith(
      { latitude: -1.94, longitude: 30.06, address: 'KG 10', locationType: 'precise' },
      'Home',
    );
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('rolls back optimistic add on repository failure', async () => {
    mockListSavedLocations.mockResolvedValue([
      { id: 'work', label: 'Work', address: 'KG 15', latitude: -1.945, longitude: 30.065 } satisfies SavedLocation,
    ]);
    mockSaveLocation.mockResolvedValue(false);
    const { wrapper, client } = createWrapper();

    renderHook(() => useSavedLocationsQuery('user-1'), { wrapper });
    const { result } = renderHook(() => useAddSavedLocationMutation('user-1'), { wrapper });

    await expect(result.current.mutateAsync({
      location: { latitude: -1.94, longitude: 30.06, address: 'KG 10', locationType: 'precise' },
      label: 'Home',
    })).rejects.toThrow('Unable to save location.');

    const cached = client.getQueryData<SavedLocation[]>(savedLocationKeys.list('user-1')) ?? [];
    expect(cached).toEqual([
      { id: 'work', label: 'Work', address: 'KG 15', latitude: -1.945, longitude: 30.065 },
    ]);
  });

  test('optimistically edits and deletes saved locations', async () => {
    mockListSavedLocations.mockResolvedValue([
      { id: 'home', label: 'Home', address: 'KG 10', latitude: -1.94, longitude: 30.06 } satisfies SavedLocation,
      { id: 'work', label: 'Work', address: 'KG 15', latitude: -1.945, longitude: 30.065 } satisfies SavedLocation,
    ]);
    mockReplaceSavedLocations.mockResolvedValue(undefined);
    mockRemoveSavedLocation.mockResolvedValue(undefined);
    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined as never);

    const queryHook = renderHook(() => useSavedLocationsQuery('user-1'), { wrapper });
    await waitFor(() => expect(queryHook.result.current.isFetched).toBe(true));

    const editHook = renderHook(() => useEditSavedLocationMutation('user-1'), { wrapper });
    await act(async () => {
      await editHook.result.current.mutateAsync({
        id: 'home',
        location: { latitude: -1.941, longitude: 30.061, address: 'KG 10B', locationType: 'precise' },
        label: 'Home',
      });
    });
    const afterEdit = client.getQueryData<SavedLocation[]>(savedLocationKeys.list('user-1')) ?? [];
    expect(afterEdit[0]).toMatchObject({ id: 'home', label: 'Home', address: 'KG 10B' });

    const deleteHook = renderHook(() => useDeleteSavedLocationMutation('user-1'), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync({ id: 'work' });
    });
    const afterDelete = client.getQueryData<SavedLocation[]>(savedLocationKeys.list('user-1')) ?? [];
    expect(afterDelete).toEqual([
      expect.objectContaining({ id: 'home', label: 'Home', address: 'KG 10B' }),
    ]);
    expect(mockRemoveSavedLocation).toHaveBeenCalledWith('work');
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
