import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useOptionalAuth } from '@/context/AuthContext';
import { savedLocationsRepository } from '@/domains/saved-locations/repository';
import type { SavedLocation } from '@/domains/saved-locations/types';
import type { RideLocation } from '@/types';
import {
  useAddSavedLocationMutation,
  useDeleteSavedLocationMutation,
  useEditSavedLocationMutation,
  useSavedLocationsQuery,
} from '@/query/hooks/useSavedLocationsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { savedLocationKeys } from '@/query/keys';

interface SavedLocationsContextValue {
  savedPlaces: SavedLocation[];
  loaded: boolean;
  reload: () => Promise<void>;
  persistSavedPlaces: (next: SavedLocation[]) => Promise<void>;
  saveLocation: (location: RideLocation, label: string) => Promise<boolean>;
  updateLocation: (id: string, location: RideLocation, label: string) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
}

const SavedLocationsContext = createContext<SavedLocationsContextValue | null>(null);

export function SavedLocationsProvider({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth();
  const userId = auth?.user?.id ?? null;
  const queryClient = useQueryClient();
  const query = useSavedLocationsQuery(userId);
  const addMutation = useAddSavedLocationMutation(userId);
  const editMutation = useEditSavedLocationMutation(userId);
  const deleteMutation = useDeleteSavedLocationMutation(userId);

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const persistSavedPlaces = useCallback(async (next: SavedLocation[]) => {
    const key = savedLocationKeys.list(userId ?? 'current');
    const previous = queryClient.getQueryData<SavedLocation[]>(key) ?? [];
    queryClient.setQueryData(key, next);
    try {
      await queryClient.cancelQueries({ queryKey: key });
      await savedLocationsRepository.replaceSavedLocations(next);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      queryClient.setQueryData(key, previous);
      throw error;
    }
  }, [queryClient, userId]);

  const saveLocation = useCallback(async (location: RideLocation, label: string) => {
    const result = await addMutation.mutateAsync({ location, label });
    return Boolean(result);
  }, [addMutation]);

  const updateLocation = useCallback(async (id: string, location: RideLocation, label: string) => {
    await editMutation.mutateAsync({ id, location, label });
  }, [editMutation]);

  const removeLocation = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync({ id });
  }, [deleteMutation]);

  const value = useMemo(
    () => ({
      savedPlaces: query.data ?? [],
      loaded: query.isFetched,
      reload,
      persistSavedPlaces,
      saveLocation,
      updateLocation,
      removeLocation,
    }),
    [persistSavedPlaces, query.data, query.isFetched, reload, saveLocation, updateLocation, removeLocation],
  );

  return (
    <SavedLocationsContext.Provider value={value}>
      {children}
    </SavedLocationsContext.Provider>
  );
}

export function useSavedLocations() {
  const context = useContext(SavedLocationsContext);
  if (!context) {
    throw new Error('useSavedLocations must be used within SavedLocationsProvider');
  }
  return context;
}
