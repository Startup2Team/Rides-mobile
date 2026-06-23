import { STORAGE_KEYS } from '@/constants/storage';
import type {
  DriverApplicationSubmission,
  VehicleApplicationSubmission,
  VehicleDocumentUpdateSubmission,
} from '@/types';
import { verificationSubmissionStoreSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export interface VerificationSubmissionStore {
  driverApplications: DriverApplicationSubmission[];
  vehicleApplications: VehicleApplicationSubmission[];
  vehicleDocumentUpdates: VehicleDocumentUpdateSubmission[];
}

export const EMPTY_VERIFICATION_SUBMISSION_STORE: VerificationSubmissionStore = {
  driverApplications: [],
  vehicleApplications: [],
  vehicleDocumentUpdates: [],
};

export const loadStoredVerificationSubmissions = () =>
  loadSecureStorage<VerificationSubmissionStore>(STORAGE_KEYS.verificationSubmissions, verificationSubmissionStoreSchema);

export const saveStoredVerificationSubmissions = (store: VerificationSubmissionStore) =>
  saveSecureStorage(STORAGE_KEYS.verificationSubmissions, store);
