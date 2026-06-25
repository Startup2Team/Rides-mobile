import { STORAGE_KEYS } from '@/constants/storage';
import { profileImageSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage, removeSecureStorage } from './secureStorage';

export const loadStoredProfileImage = () =>
  loadSecureStorage(STORAGE_KEYS.profileImage, profileImageSchema);

export const saveStoredProfileImage = (uri: string) =>
  saveSecureStorage(STORAGE_KEYS.profileImage, uri);

export const removeStoredProfileImage = () =>
  removeSecureStorage(STORAGE_KEYS.profileImage);
