import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverOnboardingDraft } from '@/hooks/driver-onboarding/onboardingTypes';
import { driverOnboardingDraftSchema } from './storageSchemas';
import { loadSecureStorage, removeSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredDriverOnboardingDraft = () =>
  loadSecureStorage<DriverOnboardingDraft>(STORAGE_KEYS.driverOnboardingDraft, driverOnboardingDraftSchema);

export const saveStoredDriverOnboardingDraft = (draft: DriverOnboardingDraft) =>
  saveSecureStorage(STORAGE_KEYS.driverOnboardingDraft, draft);

export const removeStoredDriverOnboardingDraft = () =>
  removeSecureStorage(STORAGE_KEYS.driverOnboardingDraft);
