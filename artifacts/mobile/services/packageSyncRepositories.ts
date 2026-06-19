import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  validatePackageCatalog,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import {
  validatePackageCampaigns,
  type DriverRidePackageCampaign,
} from '@/domain/driverRideCampaigns';
import {
  loadPackageCampaignCache,
  loadPackageCatalogCache,
  loadPackageOfferSourceCache,
  savePackageCampaignCache,
  savePackageCatalogCache,
  savePackageOfferSourceCache,
  type PackageOfferSourceCache,
  type PackageSyncCache,
} from '@/persistence/packageSyncPersistence';

export interface PackageCatalogBackendAdapter {
  fetchPackages(): Promise<{
    data: DriverRidePackageCatalogEntry[];
    sourceVersion: string;
  }>;
}

export interface PackageCampaignBackendAdapter {
  fetchCampaigns(): Promise<{
    data: DriverRidePackageCampaign[];
    sourceVersion: string;
  }>;
}

export interface PackageCatalogRepository {
  getCatalog(): Promise<DriverRidePackageCatalogEntry[] | null>;
  refreshCatalog(): Promise<DriverRidePackageCatalogEntry[]>;
  getLastSyncTime(): Promise<string | null>;
}

export interface PackageCampaignRepository {
  getCampaigns(): Promise<DriverRidePackageCampaign[] | null>;
  refreshCampaigns(): Promise<DriverRidePackageCampaign[]>;
  getLastSyncTime(): Promise<string | null>;
}

export interface PackageOfferSourceRepository {
  getOfferSource(): Promise<PackageOfferSourceCache | null>;
  refreshOfferSource(): Promise<PackageOfferSourceCache>;
  getLastSyncTime(): Promise<string | null>;
}

export class MockPackageCatalogBackendAdapter implements PackageCatalogBackendAdapter {
  async fetchPackages() {
    return {
      data: DRIVER_RIDE_PACKAGE_CATALOG.map(entry => ({ ...entry })),
      sourceVersion: 'mock-catalog-v1',
    };
  }
}

export class MockPackageCampaignBackendAdapter implements PackageCampaignBackendAdapter {
  constructor(private readonly campaigns: DriverRidePackageCampaign[] = []) {}

  async fetchCampaigns() {
    return {
      data: this.campaigns.map(campaign => ({ ...campaign })),
      sourceVersion: 'mock-campaigns-v1',
    };
  }
}

export class CachedPackageCatalogRepository implements PackageCatalogRepository {
  constructor(
    private readonly adapter: PackageCatalogBackendAdapter = new MockPackageCatalogBackendAdapter(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getCatalog() {
    return (await loadPackageCatalogCache()).data?.data ?? null;
  }

  async refreshCatalog() {
    const response = await this.adapter.fetchPackages();
    const data = validatePackageCatalog(response.data);
    const now = this.now().toISOString();
    const previous = (await loadPackageCatalogCache()).data;
    const cache: PackageSyncCache<DriverRidePackageCatalogEntry[]> = {
      data,
      lastSyncedAt: now,
      sourceVersion: response.sourceVersion,
      cacheCreatedAt: previous?.cacheCreatedAt ?? now,
    };
    await savePackageCatalogCache(cache);
    return data;
  }

  async getLastSyncTime() {
    return (await loadPackageCatalogCache()).data?.lastSyncedAt ?? null;
  }
}

export class CachedPackageCampaignRepository implements PackageCampaignRepository {
  constructor(
    private readonly adapter: PackageCampaignBackendAdapter = new MockPackageCampaignBackendAdapter(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getCampaigns() {
    return (await loadPackageCampaignCache()).data?.data ?? null;
  }

  async refreshCampaigns() {
    const response = await this.adapter.fetchCampaigns();
    const data = validatePackageCampaigns(response.data);
    const now = this.now().toISOString();
    const previous = (await loadPackageCampaignCache()).data;
    const cache: PackageSyncCache<DriverRidePackageCampaign[]> = {
      data,
      lastSyncedAt: now,
      sourceVersion: response.sourceVersion,
      cacheCreatedAt: previous?.cacheCreatedAt ?? now,
    };
    await savePackageCampaignCache(cache);
    return data;
  }

  async getLastSyncTime() {
    return (await loadPackageCampaignCache()).data?.lastSyncedAt ?? null;
  }
}

export class CachedPackageOfferSourceRepository implements PackageOfferSourceRepository {
  constructor(
    private readonly catalogAdapter: PackageCatalogBackendAdapter = new MockPackageCatalogBackendAdapter(),
    private readonly campaignAdapter: PackageCampaignBackendAdapter = new MockPackageCampaignBackendAdapter(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getOfferSource() {
    return (await loadPackageOfferSourceCache()).data;
  }

  async refreshOfferSource() {
    // Both responses are validated before the single cache commit. A partial
    // backend failure therefore cannot replace either half of the generation.
    const [catalogResponse, campaignResponse] = await Promise.all([
      this.catalogAdapter.fetchPackages(),
      this.campaignAdapter.fetchCampaigns(),
    ]);
    const catalog = validatePackageCatalog(catalogResponse.data);
    const campaigns = validatePackageCampaigns(campaignResponse.data);
    const refreshedAt = this.now().toISOString();
    const previous = (await loadPackageOfferSourceCache()).data;
    const cache: PackageOfferSourceCache = {
      catalog,
      campaigns,
      catalogLoaded: true,
      campaignsLoaded: true,
      generation: `offer-source:${refreshedAt}:${catalogResponse.sourceVersion}:${campaignResponse.sourceVersion}`,
      lastSuccessfulGenerationAt: refreshedAt,
      sourceVersion: `${catalogResponse.sourceVersion}:${campaignResponse.sourceVersion}`,
      cacheCreatedAt: previous?.cacheCreatedAt ?? refreshedAt,
    };
    await savePackageOfferSourceCache(cache);
    return cache;
  }

  async getLastSyncTime() {
    return (await loadPackageOfferSourceCache()).data?.lastSuccessfulGenerationAt ?? null;
  }
}

export const packageCatalogRepository = new CachedPackageCatalogRepository();
export const packageCampaignRepository = new CachedPackageCampaignRepository();
export const packageOfferSourceRepository = new CachedPackageOfferSourceRepository();
