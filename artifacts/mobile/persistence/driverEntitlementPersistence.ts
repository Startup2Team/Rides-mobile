import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { driverEntitlementSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

let cachedDriverEntitlement: DriverEntitlement | null = null;

export const loadStoredDriverEntitlement = () =>
  loadSecureStorage<DriverEntitlement>(STORAGE_KEYS.driverEntitlement, driverEntitlementSchema).then(result => {
    cachedDriverEntitlement = result.data ?? null;
    return result;
  });

export const saveStoredDriverEntitlement = (entitlement: DriverEntitlement) =>
  saveSecureStorage(STORAGE_KEYS.driverEntitlement, entitlement).then(() => {
    cachedDriverEntitlement = entitlement;
  });

export function getStoredDriverEntitlementSnapshot() {
  return cachedDriverEntitlement;
}

export function clearStoredDriverEntitlementSnapshot() {
  cachedDriverEntitlement = null;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as typeof globalThis & {
    __RIDES_CLEAR_DRIVER_ENTITLEMENT_CACHE__?: () => void;
  }).__RIDES_CLEAR_DRIVER_ENTITLEMENT_CACHE__ = clearStoredDriverEntitlementSnapshot;
}
