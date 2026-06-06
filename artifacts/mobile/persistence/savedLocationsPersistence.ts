import { STORAGE_KEYS } from '@/constants/storage';
import type { SavedLocation } from '@/types';
import { savedLocationsSchema } from './storageSchemas';
import { loadVersionedStorage, saveVersionedStorage } from './versionedStorage';

export const loadStoredSavedLocations = () =>
  loadVersionedStorage<SavedLocation[]>(STORAGE_KEYS.savedLocations, savedLocationsSchema);
export const saveStoredSavedLocations = (locations: SavedLocation[]) =>
  saveVersionedStorage(STORAGE_KEYS.savedLocations, locations);
