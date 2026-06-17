import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MAX_SAVED_LOCATIONS } from '@/constants/savedLocations';
import {
  loadStoredSavedLocations,
  saveStoredSavedLocations,
} from '@/persistence/savedLocationsPersistence';
import {
  getSavedLocations,
  createSavedLocation as createSavedLocationAPI,
  deleteSavedLocation as deleteSavedLocationAPI,
} from '@/services/savedLocations';
import { RideLocation, SavedLocation } from '@/types';

interface SavedLocationsContextValue {
  savedPlaces: SavedLocation[];
  loaded: boolean;
  reload: () => Promise<void>;
  persistSavedPlaces: (next: SavedLocation[]) => Promise<void>;
  saveLocation: (location: RideLocation, label: string) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<void>;
}

const SavedLocationsContext = createContext<SavedLocationsContextValue | null>(null);

export function SavedLocationsProvider({ children }: { children: React.ReactNode }) {
  const [savedPlaces, setSavedPlaces] = useState<SavedLocation[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const { data } = await getSavedLocations();
      const backendPlaces: SavedLocation[] = (data?.locations ?? data ?? []).map((loc: any) => ({
        id: loc.id,
        label: loc.label,
        address: loc.address,
        latitude: loc.lat ?? loc.latitude,
        longitude: loc.lng ?? loc.longitude,
      }));
      setSavedPlaces(backendPlaces);
      await saveStoredSavedLocations(backendPlaces);
    } catch {
      const stored = await loadStoredSavedLocations();
      setSavedPlaces(stored.data ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persistSavedPlaces = useCallback(async (next: SavedLocation[]) => {
    setSavedPlaces(next);
    await saveStoredSavedLocations(next);
  }, []);

  const saveLocation = useCallback(async (location: RideLocation, label: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return false;

    let saved: SavedLocation = {
      ...location,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      label: cleanLabel,
    };

    try {
      const { data } = await createSavedLocationAPI(
        cleanLabel,
        location.address ?? '',
        location.latitude,
        location.longitude,
      );
      if (data?.id) saved = { ...saved, id: data.id };
    } catch {
      // Offline — keep local ID; will sync on next reload
    }

    setSavedPlaces(current => {
      const next = [saved, ...current.filter(place => place.label !== cleanLabel)].slice(0, MAX_SAVED_LOCATIONS);
      void saveStoredSavedLocations(next);
      return next;
    });
    return true;
  }, []);

  const deleteLocation = useCallback(async (id: string) => {
    setSavedPlaces(current => {
      const next = current.filter(place => place.id !== id);
      void saveStoredSavedLocations(next);
      return next;
    });
    try {
      await deleteSavedLocationAPI(id);
    } catch {
      // Offline — removed locally; backend will diverge until next reload
    }
  }, []);

  const value = useMemo(
    () => ({
      savedPlaces,
      loaded,
      reload,
      persistSavedPlaces,
      saveLocation,
      deleteLocation,
    }),
    [deleteLocation, loaded, persistSavedPlaces, reload, saveLocation, savedPlaces],
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
