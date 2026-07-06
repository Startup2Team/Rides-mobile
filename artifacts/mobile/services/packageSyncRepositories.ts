import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  validatePackageCatalog,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import { listRidePackages, type RidePackage } from '@/services/driverPackages';
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

// Real backend catalog: GET /driver/packages. Only APPROVED (active) drivers can
// list packages, so on any failure we fall back to the bundled catalog to keep
// the packages screen usable rather than blank.
function backendPackageToCatalogEntry(pkg: RidePackage): DriverRidePackageCatalogEntry {
  const now = new Date().toISOString();
  return {
    packageId: pkg.id,
    packageVersion: 'backend-v1',
    packageName: pkg.name,
    vehicleType: pkg.vehicleType ?? 'moto',
    priceRwf: pkg.priceRwf,
    isFreeTrial: pkg.priceRwf === 0,
    ridesGranted: pkg.rideCount,
    bonusRidesGranted: pkg.bonusRides,
    status: 'active',
    createdAt: now,
    effectiveFrom: now,
    effectiveUntil: null,
  };
}

export class BackendPackageCatalogAdapter implements PackageCatalogBackendAdapter {
  async fetchPackages() {
    try {
      const packages = await listRidePackages();
      if (packages.length > 0) {
        return {
          data: packages.map(backendPackageToCatalogEntry),
          sourceVersion: `backend-${Date.now()}`,
        };
      }
    } catch {
      // fall through to the bundled catalog
    }
    return {
      data: DRIVER_RIDE_PACKAGE_CATALOG.map(entry => ({ ...entry })),
      sourceVersion: 'bundled-catalog-fallback',
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
    private readonly adapter: PackageCatalogBackendAdapter = new BackendPackageCatalogAdapter(),
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
