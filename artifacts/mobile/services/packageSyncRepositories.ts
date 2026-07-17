import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  validatePackageCatalog,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import { listRidePackages, listActiveCampaigns, type RidePackage, type CampaignDto } from '@/services/driverPackages';
import { fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';
import {
  validatePackageCampaigns,
  type DriverRideCampaignType,
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

// Real backend campaigns: GET /driver/campaigns/active. The endpoint returns
// only currently-running campaigns, so status is 'active'. Mapping is
// defensive: the response has no created_at and nullable start/end dates, and
// the backend PACKAGE type has no mobile equivalent — any campaign that can't
// be cleanly mapped is dropped rather than throwing, because campaigns are
// promotional and must never blank out the packages screen.
const BACKEND_CAMPAIGN_TYPE: Record<string, DriverRideCampaignType> = {
  GLOBAL: 'global',
  VEHICLE_TYPE: 'vehicle_type',
  FIRST_PURCHASE: 'first_purchase',
  REFERRAL: 'referral',
};

// Stable sentinel window used when the backend leaves start/end open-ended.
const CAMPAIGN_WINDOW_START = '2020-01-01T00:00:00.000Z';
const CAMPAIGN_WINDOW_END = '2099-12-31T00:00:00.000Z';

function validDateString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function nonNegativeInt(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function backendCampaignToDomain(dto: CampaignDto): DriverRidePackageCampaign | null {
  const campaignType = BACKEND_CAMPAIGN_TYPE[dto.type];
  if (!campaignType) return null; // PACKAGE or unknown → drop
  if (!dto.id?.trim() || !dto.name?.trim()) return null;

  const startDate = validDateString(dto.starts_at) ?? CAMPAIGN_WINDOW_START;
  let endDate = validDateString(dto.ends_at) ?? CAMPAIGN_WINDOW_END;
  // Validator requires endDate > startDate.
  if (new Date(endDate).getTime() <= new Date(startDate).getTime()) endDate = CAMPAIGN_WINDOW_END;

  const vehicleType = dto.target_vehicle_type_code
    ? fromBackendTransportType(dto.target_vehicle_type_code)
    : null;

  return {
    campaignId: dto.id,
    campaignName: dto.name,
    campaignType,
    status: 'active',
    startDate,
    endDate,
    createdAt: startDate,
    description: dto.description ?? '',
    ...(vehicleType ? { vehicleTypes: [vehicleType] as VehicleType[] } : {}),
    ...(nonNegativeInt(dto.override_price_rwf) !== undefined ? { priceRwf: nonNegativeInt(dto.override_price_rwf) } : {}),
    ...(nonNegativeInt(dto.override_rides) !== undefined ? { ridesGranted: nonNegativeInt(dto.override_rides) } : {}),
    ...(nonNegativeInt(dto.override_bonus_rides) !== undefined ? { bonusRidesGranted: nonNegativeInt(dto.override_bonus_rides) } : {}),
  };
}

export class BackendPackageCampaignAdapter implements PackageCampaignBackendAdapter {
  async fetchCampaigns() {
    try {
      const dtos = await listActiveCampaigns();
      const data = dtos
        .map(backendCampaignToDomain)
        .filter((c): c is DriverRidePackageCampaign => c !== null);
      return { data, sourceVersion: `backend-${Date.now()}` };
    } catch {
      // Approved-driver-only endpoint or backend unreachable — no campaigns.
      return { data: [], sourceVersion: 'backend-campaigns-unavailable' };
    }
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
    private readonly adapter: PackageCampaignBackendAdapter = new BackendPackageCampaignAdapter(),
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
    private readonly catalogAdapter: PackageCatalogBackendAdapter = new BackendPackageCatalogAdapter(),
    private readonly campaignAdapter: PackageCampaignBackendAdapter = new BackendPackageCampaignAdapter(),
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
