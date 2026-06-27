import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MAX_SAVED_LOCATIONS } from '@/constants/savedLocations';
import { savedLocationsRepository } from '@/domains/saved-locations/repository';
import type { SavedLocation } from '@/domains/saved-locations/types';
import type { RideLocation } from '@/types';

interface SavedLocationsContextValue {
  savedPlaces: SavedLocation[];
  loaded: boolean;
  reload: () => Promise<void>;
  persistSavedPlaces: (next: SavedLocation[]) => Promise<void>;
  saveLocation: (location: RideLocation, label: string) => Promise<boolean>;
}

const SavedLocationsContext = createContext<SavedLocationsContextValue | null>(null);

export function SavedLocationsProvider({ children }: { children: React.ReactNode }) {
  const [savedPlaces, setSavedPlaces] = useState<SavedLocation[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const stored = await savedLocationsRepository.listSavedLocations();
      setSavedPlaces(stored);
    } catch {
      setSavedPlaces([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persistSavedPlaces = useCallback(async (next: SavedLocation[]) => {
    setSavedPlaces(next);
    await savedLocationsRepository.replaceSavedLocations(next);
  }, []);

  const saveLocation = useCallback(async (location: RideLocation, label: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return false;

    const saved: SavedLocation = {
      ...location,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      label: cleanLabel,
    };

    setSavedPlaces(current => {
      const next = [saved, ...current.filter(place => place.label !== cleanLabel)].slice(0, MAX_SAVED_LOCATIONS);
      void savedLocationsRepository.replaceSavedLocations(next);
      return next;
    });
    return true;
  }, []);

  const value = useMemo(
    () => ({
      savedPlaces,
      loaded,
      reload,
      persistSavedPlaces,
      saveLocation,
    }),
    [loaded, persistSavedPlaces, reload, saveLocation, savedPlaces],
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
