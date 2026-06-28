import type { AuthRepository } from './interfaces';
import { loadStoredDriverProfile, loadStoredUser, saveStoredDriverProfile, saveStoredUser } from '@/persistence/authPersistence';
import type { DriverProfile, User } from '@/types';

export const authRepository: AuthRepository = {
  async getCurrentUser() {
    return (await loadStoredUser()).data;
  },
  async saveCurrentUser(user: User) {
    await saveStoredUser(user);
  },
  async getDriverProfile() {
    return (await loadStoredDriverProfile()).data;
  },
  async saveDriverProfile(profile: DriverProfile) {
    await saveStoredDriverProfile(profile);
  },
  async clearSession() {
    return undefined;
  },
};
