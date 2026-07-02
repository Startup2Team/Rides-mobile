import type { ProfileRepository } from '@/data/repositories/interfaces';
import {
  loadStoredProfileImage,
  removeStoredProfileImage,
  saveStoredProfileImage,
} from '@/persistence/profilePersistence';

export const profileRepository: ProfileRepository = {
  async getProfileImage() {
    const stored = await loadStoredProfileImage();
    return stored.data;
  },
  async saveProfileImage(uri: string) {
    await saveStoredProfileImage(uri);
  },
  async removeProfileImage() {
    await removeStoredProfileImage();
  },
};

export type { ProfileRepository } from '@/data/repositories/interfaces';
export { createRemoteProfileRepository, createProfileShadowRepository } from '@/data/remote/repositories/RemoteProfileRepository';
