import { useSavedLocations as useSavedLocationsContext } from '@/context/SavedLocationsContext';
import type { RideLocation } from '@/types';
import type { SavedLocation } from './types';

export function useSavedLocations() {
  return useSavedLocationsContext();
}

export function useSavedLocationActions() {
  const { reload, persistSavedPlaces, saveLocation } = useSavedLocationsContext();

  return {
    reload,
    persistSavedPlaces,
    saveLocation,
  } satisfies {
    reload: () => Promise<void>;
    persistSavedPlaces: (next: SavedLocation[]) => Promise<void>;
    saveLocation: (location: RideLocation, label: string) => Promise<boolean>;
  };
}

