import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { driverEntitlementSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredDriverEntitlement = () =>
  loadSecureStorage<DriverEntitlement>(STORAGE_KEYS.driverEntitlement, driverEntitlementSchema);

export const saveStoredDriverEntitlement = (entitlement: DriverEntitlement) =>
  saveSecureStorage(STORAGE_KEYS.driverEntitlement, entitlement);
