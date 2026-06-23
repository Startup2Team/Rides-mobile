import { api } from './api';
import {
  LEGACY_TO_API_VEHICLE,
  API_TO_LEGACY_VEHICLE,
  type LegacyVehicleType,
  type VehicleTypeCode,
} from './vehicleTypes';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type {
  PackageCatalogBackendAdapter,
  PackageCampaignBackendAdapter,
} from './packageSyncRepositories';

// Vehicle types we ask the catalog endpoint for (one call each; the endpoint is
// per-vehicle-type, the adapter contract is "fetch everything").
const CATALOG_VEHICLE_CODES: VehicleTypeCode[] = Object.values(LEGACY_TO_API_VEHICLE);

const STABLE_TS = '2026-06-01T00:00:00.000Z'; // catalog entries need a valid date

interface BackendCatalogItem {
  id: string;
  code?: string;
  name: string;
  vehicle_type_code: string;
  normal_price_rwf: number;
  current_price_rwf: number;
  included_rides: number;
  bonus_rides: number;
  version_number?: number;
  version_id?: string;
  launch_offer?: boolean;
}

function mapCatalogItem(item: BackendCatalogItem): DriverRidePackageCatalogEntry | null {
  const vehicleType = API_TO_LEGACY_VEHICLE[item.vehicle_type_code as VehicleTypeCode];
  if (!vehicleType) return null; // unknown vehicle type — skip
  const entry: DriverRidePackageCatalogEntry = {
    packageId: item.id, // backend uuid is the stable id (used for purchase)
    packageVersion: item.version_number != null ? `v${item.version_number}` : (item.version_id ?? 'v1'),
    packageName: item.name,
    vehicleType,
    priceRwf: item.current_price_rwf,
    ridesGranted: item.included_rides,
    bonusRidesGranted: item.bonus_rides,
    status: 'active', // the endpoint only returns active versions
    createdAt: STABLE_TS,
    effectiveFrom: STABLE_TS,
    effectiveUntil: null,
  };
  // Show the strike-through "was" price only when a campaign lowered it.
  if (item.normal_price_rwf > item.current_price_rwf) {
    entry.compareAtPriceRwf = item.normal_price_rwf;
  }
  return entry;
}

/** Real catalog adapter: GET /driver/packages for every vehicle type, mapped to
 *  the strict DriverRidePackageCatalogEntry shape. */
export class ApiPackageCatalogBackendAdapter implements PackageCatalogBackendAdapter {
  async fetchPackages() {
    const responses = await Promise.all(
      CATALOG_VEHICLE_CODES.map(async code => {
        try {
          const { data } = await api.get(`/driver/packages?vehicle_type=${encodeURIComponent(code)}`);
          return Array.isArray(data) ? (data as BackendCatalogItem[]) : [];
        } catch {
          return [];
        }
      }),
    );
    const data = responses
      .flat()
      .map(mapCatalogItem)
      .filter((e): e is DriverRidePackageCatalogEntry => e !== null);
    return { data, sourceVersion: `api-catalog:${Date.now()}` };
  }
}

interface BackendCampaignItem {
  id: string;
  code: string;
  name: string;
  type: string; // GLOBAL | VEHICLE_TYPE | PACKAGE | FIRST_PURCHASE | REFERRAL
  starts_at?: string | null;
  ends_at?: string | null;
  override_price_rwf?: number | null;
  override_rides?: number | null;
  override_bonus_rides?: number | null;
}

const CAMPAIGN_TYPE_MAP: Record<string, DriverRidePackageCampaign['campaignType']> = {
  GLOBAL: 'global',
  VEHICLE_TYPE: 'vehicle_type',
  PACKAGE: 'vehicle_type', // package-targeted maps to vehicle_type bucket for the mobile
  FIRST_PURCHASE: 'first_purchase',
  REFERRAL: 'referral',
};

function mapCampaignItem(item: BackendCampaignItem): DriverRidePackageCampaign | null {
  const campaignType = CAMPAIGN_TYPE_MAP[item.type];
  if (!campaignType) return null;
  const now = Date.now();
  // The mobile validator requires endDate > startDate; synthesize a window when
  // the backend leaves the campaign open-ended.
  const startDate = item.starts_at ?? new Date(now).toISOString();
  const endDate = item.ends_at ?? new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
  const campaign: DriverRidePackageCampaign = {
    campaignId: item.id,
    campaignName: item.name,
    campaignType,
    status: 'active', // /campaigns/active only returns active ones
    startDate,
    endDate,
    createdAt: startDate,
    description: item.name,
  };
  if (item.override_price_rwf != null) campaign.priceRwf = item.override_price_rwf;
  if (item.override_rides != null) campaign.ridesGranted = item.override_rides;
  if (item.override_bonus_rides != null) campaign.bonusRidesGranted = item.override_bonus_rides;
  return campaign;
}

/** Real campaign adapter: GET /driver/campaigns/active mapped to the strict shape. */
export class ApiPackageCampaignBackendAdapter implements PackageCampaignBackendAdapter {
  async fetchCampaigns() {
    // Campaigns are queried per vehicle type; gather across all and de-dupe.
    const responses = await Promise.all(
      CATALOG_VEHICLE_CODES.map(async code => {
        try {
          const { data } = await api.get(`/driver/campaigns/active?vehicle_type=${encodeURIComponent(code)}`);
          return Array.isArray(data) ? (data as BackendCampaignItem[]) : [];
        } catch {
          return [];
        }
      }),
    );
    const seen = new Set<string>();
    const data = responses
      .flat()
      .map(mapCampaignItem)
      .filter((c): c is DriverRidePackageCampaign => c !== null)
      .filter(c => (seen.has(c.campaignId) ? false : (seen.add(c.campaignId), true)));
    return { data, sourceVersion: `api-campaigns:${Date.now()}` };
  }
}

// Touch the type import so it isn't flagged unused when tree-shaken.
export type { LegacyVehicleType };
