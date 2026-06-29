import type { DriverEntitlement, DriverPackagePurchase } from './types';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import {
  packageCampaignRepository,
  packageCatalogRepository,
  packageOfferSourceRepository,
} from '@/services/packageSyncRepositories';
import type { PackageRepository } from '@/data/repositories/interfaces';

export const packageRepository: PackageRepository = {
  async getCatalog() {
    return packageCatalogRepository.getCatalog();
  },

  async refreshCatalog() {
    return packageCatalogRepository.refreshCatalog();
  },

  async getCampaigns() {
    return packageCampaignRepository.getCampaigns();
  },

  async refreshCampaigns() {
    return packageCampaignRepository.refreshCampaigns();
  },

  async getOfferSource() {
    return packageOfferSourceRepository.getOfferSource();
  },

  async refreshOfferSource() {
    return packageOfferSourceRepository.refreshOfferSource();
  },
};

export type { PackageRepository } from '@/data/repositories/interfaces';

export async function getDriverEntitlement() {
  const stored = await loadStoredDriverEntitlement();
  return stored.data ?? null;
}

export async function saveDriverEntitlement(entitlement: DriverEntitlement) {
  await saveStoredDriverEntitlement(entitlement);
}

export async function clearDriverEntitlement() {
  await saveStoredDriverEntitlement(EMPTY_DRIVER_ENTITLEMENT);
}

export async function getDriverPackagePurchases() {
  const entitlement = await getDriverEntitlement();
  return entitlement?.purchaseHistory ?? [];
}

export async function saveDriverPackagePurchases(purchases: DriverPackagePurchase[]) {
  const entitlement = (await getDriverEntitlement()) ?? EMPTY_DRIVER_ENTITLEMENT;
  await saveDriverEntitlement({
    ...entitlement,
    purchaseHistory: purchases,
  });
}
