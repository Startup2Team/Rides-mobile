import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverProfile, User } from '@/types';
import { driverProfileSchema, userSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredUser = () => loadSecureStorage<User>(STORAGE_KEYS.user, userSchema);
export const saveStoredUser = (user: User) => saveSecureStorage(STORAGE_KEYS.user, user);
export const loadStoredDriverProfile = () =>
  loadSecureStorage<DriverProfile>(STORAGE_KEYS.driverProfile, driverProfileSchema);
export const saveStoredDriverProfile = (profile: DriverProfile) =>
  saveSecureStorage(STORAGE_KEYS.driverProfile, profile);
