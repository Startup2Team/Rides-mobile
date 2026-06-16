import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverDocuments } from '@/domain/driverDocuments';
import { driverDocumentsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredDriverDocuments = () =>
  loadSecureStorage<DriverDocuments>(STORAGE_KEYS.driverDocuments, driverDocumentsSchema);

export const saveStoredDriverDocuments = (documents: DriverDocuments) =>
  saveSecureStorage(STORAGE_KEYS.driverDocuments, documents);
