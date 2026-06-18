import { STORAGE_KEYS } from '@/constants/storage';
import { attachLegacyDocumentsToPrimaryVehicle, migrateDriverProfileToMultiVehicle } from '@/domain/driverVehicles';
import type { DriverProfile, User } from '@/types';
import { driverProfileSchema, userSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';
import { loadStoredDriverDocuments } from './driverDocumentsPersistence';

export const loadStoredUser = () => loadSecureStorage<User>(STORAGE_KEYS.user, userSchema);
export const saveStoredUser = (user: User) => saveSecureStorage(STORAGE_KEYS.user, user);

export const loadStoredDriverProfile = async () => {
  const stored = await loadSecureStorage<DriverProfile>(STORAGE_KEYS.driverProfile, driverProfileSchema);
  if (!stored.data) return stored;

  const legacyDocuments = await loadStoredDriverDocuments();
  const migrated = attachLegacyDocumentsToPrimaryVehicle(
    migrateDriverProfileToMultiVehicle(stored.data),
    legacyDocuments.data,
  );
  await saveSecureStorage(STORAGE_KEYS.driverProfile, migrated);
  return { ...stored, data: migrated };
};

export const saveStoredDriverProfile = (profile: DriverProfile) =>
  saveSecureStorage(STORAGE_KEYS.driverProfile, migrateDriverProfileToMultiVehicle(profile));
