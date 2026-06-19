import { z } from 'zod';
import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import { loadVersionedStorage, saveVersionedStorage } from './versionedStorage';

const vehicleTypeSchema = z.enum(['moto', 'rifani', 'cab', 'fuso', 'hilux']);
const packageStatusSchema = z.enum(['draft', 'active', 'scheduled', 'expired', 'archived']);
const campaignStatusSchema = z.enum(['draft', 'scheduled', 'active', 'expired', 'archived']);
const campaignTypeSchema = z.enum(['global', 'vehicle_type', 'first_purchase', 'referral']);

const catalogEntrySchema = z.object({
  packageId: z.string().trim().min(1),
  packageVersion: z.string().trim().min(1),
  packageName: z.string().trim().min(1),
  vehicleType: vehicleTypeSchema,
  priceRwf: z.number().nonnegative(),
  ridesGranted: z.number().int().nonnegative(),
  bonusRidesGranted: z.number().int().nonnegative(),
  status: packageStatusSchema,
  createdAt: z.string(),
  effectiveFrom: z.string(),
  effectiveUntil: z.string().nullable(),
  compareAtPriceRwf: z.number().nonnegative().optional(),
});

const campaignSchema = z.object({
  campaignId: z.string().trim().min(1),
  campaignName: z.string().trim().min(1),
  campaignType: campaignTypeSchema,
  status: campaignStatusSchema,
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  description: z.string(),
  packageIds: z.array(z.string().trim().min(1)).optional(),
  vehicleTypes: z.array(vehicleTypeSchema).optional(),
  priceRwf: z.number().nonnegative().optional(),
  ridesGranted: z.number().int().nonnegative().optional(),
  bonusRidesGranted: z.number().int().nonnegative().optional(),
});

const syncMetadataSchema = z.object({
  lastSyncedAt: z.string(),
  sourceVersion: z.string().trim().min(1),
  cacheCreatedAt: z.string(),
});

export interface PackageSyncCache<T> {
  data: T;
  lastSyncedAt: string;
  sourceVersion: string;
  cacheCreatedAt: string;
}

export interface PackageOfferSourceCache {
  catalog: DriverRidePackageCatalogEntry[];
  campaigns: DriverRidePackageCampaign[];
  catalogLoaded: true;
  campaignsLoaded: true;
  generation: string;
  lastSuccessfulGenerationAt: string;
  sourceVersion: string;
  cacheCreatedAt: string;
}

export const packageCatalogCacheSchema = syncMetadataSchema.extend({
  data: z.array(catalogEntrySchema),
});

export const packageCampaignCacheSchema = syncMetadataSchema.extend({
  data: z.array(campaignSchema),
});

export const packageOfferSourceCacheSchema = z.object({
  catalog: z.array(catalogEntrySchema),
  campaigns: z.array(campaignSchema),
  catalogLoaded: z.literal(true),
  campaignsLoaded: z.literal(true),
  generation: z.string().trim().min(1),
  lastSuccessfulGenerationAt: z.string(),
  sourceVersion: z.string().trim().min(1),
  cacheCreatedAt: z.string(),
});

export const loadPackageCatalogCache = () =>
  loadVersionedStorage<PackageSyncCache<DriverRidePackageCatalogEntry[]>>(
    STORAGE_KEYS.packageCatalogCache,
    packageCatalogCacheSchema,
  );

export const savePackageCatalogCache = (
  cache: PackageSyncCache<DriverRidePackageCatalogEntry[]>,
) => saveVersionedStorage(STORAGE_KEYS.packageCatalogCache, cache);

export const loadPackageCampaignCache = () =>
  loadVersionedStorage<PackageSyncCache<DriverRidePackageCampaign[]>>(
    STORAGE_KEYS.packageCampaignCache,
    packageCampaignCacheSchema,
  );

export const savePackageCampaignCache = (
  cache: PackageSyncCache<DriverRidePackageCampaign[]>,
) => saveVersionedStorage(STORAGE_KEYS.packageCampaignCache, cache);

export const loadPackageOfferSourceCache = () =>
  loadVersionedStorage<PackageOfferSourceCache>(
    STORAGE_KEYS.packageOfferSourceCache,
    packageOfferSourceCacheSchema,
  );

export const savePackageOfferSourceCache = (cache: PackageOfferSourceCache) =>
  saveVersionedStorage(STORAGE_KEYS.packageOfferSourceCache, cache);
