import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverProfile, User } from '@/types';
import { driverProfileSchema, userSchema } from './storageSchemas';
import { loadVersionedStorage, saveVersionedStorage } from './versionedStorage';

export const loadStoredUser = () => loadVersionedStorage<User>(STORAGE_KEYS.user, userSchema);
export const saveStoredUser = (user: User) => saveVersionedStorage(STORAGE_KEYS.user, user);
export const loadStoredDriverProfile = () =>
  loadVersionedStorage<DriverProfile>(STORAGE_KEYS.driverProfile, driverProfileSchema);
export const saveStoredDriverProfile = (profile: DriverProfile) =>
  saveVersionedStorage(STORAGE_KEYS.driverProfile, profile);
