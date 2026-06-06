import { STORAGE_KEYS } from '@/constants/storage';
import type { SavedLocation } from '@/types';
import { savedLocationsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredSavedLocations = () =>
  loadSecureStorage<SavedLocation[]>(STORAGE_KEYS.savedLocations, savedLocationsSchema);
export const saveStoredSavedLocations = (locations: SavedLocation[]) =>
  saveSecureStorage(STORAGE_KEYS.savedLocations, locations);
