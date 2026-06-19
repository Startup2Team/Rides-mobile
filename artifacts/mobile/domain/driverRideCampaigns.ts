import type { DriverPackagePurchase } from './driverRidePackages';
import type { DriverRidePackageCatalogEntry } from './driverRidePackageCatalog';
import type { VehicleType } from '@/types';

export type DriverRideCampaignType = 'global' | 'vehicle_type' | 'first_purchase' | 'referral';
export type DriverRideCampaignStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'archived';

export interface DriverRidePackageCampaign {
  campaignId: string;
  campaignName: string;
  campaignType: DriverRideCampaignType;
  status: DriverRideCampaignStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  description: string;
  packageIds?: string[];
  vehicleTypes?: VehicleType[];
  priceRwf?: number;
  ridesGranted?: number;
  bonusRidesGranted?: number;
}

export interface DriverRidePackageOffer extends DriverRidePackageCatalogEntry {
  basePriceRwf: number;
  baseRidesGranted: number;
  baseBonusRidesGranted: number;
  campaignId: string | null;
  campaignName: string | null;
  campaignType: DriverRideCampaignType | null;
  campaignStatus: DriverRideCampaignStatus | null;
  campaignDescription: string | null;
  campaignBadgeLabel: string | null;
  isPromotional: boolean;
}

type CampaignPurchaseSource = {
  purchaseHistory?: DriverPackagePurchase[];
  vehicleEntitlements?: Array<{
    purchaseHistory?: DriverPackagePurchase[];
  }>;
};

type CampaignVehicleSource = CampaignPurchaseSource & {
  vehicleType?: VehicleType | null;
};

const CAMPAIGN_PRIORITY: Record<DriverRideCampaignType, number> = {
  referral: 0,
  global: 1,
  vehicle_type: 2,
  first_purchase: 3,
};

const DEFAULT_CAMPAIGNS: DriverRidePackageCampaign[] = [];

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDateWithinCampaign(campaign: DriverRidePackageCampaign, now = new Date()) {
  const start = parseDate(campaign.startDate);
  const end = parseDate(campaign.endDate);
  if (!start || !end) return false;
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
}

function hasPreviousPaidPackagePurchase(
  driver: CampaignPurchaseSource | null | undefined,
) {
  if (!driver) return false;
  const vehicleEntitlements = 'vehicleEntitlements' in driver && Array.isArray(driver.vehicleEntitlements)
    ? driver.vehicleEntitlements
    : [driver];

  return vehicleEntitlements.some(vehicle =>
    (vehicle.purchaseHistory ?? []).some(purchase =>
      Number(purchase.amount) > 0 && purchase.status === 'successful',
    ),
  );
}

function campaignMatchesPackage(
  campaign: DriverRidePackageCampaign,
  packageId: string,
) {
  return !campaign.packageIds || campaign.packageIds.length === 0 || campaign.packageIds.includes(packageId);
}

function campaignMatchesVehicleType(
  campaign: DriverRidePackageCampaign,
  vehicleType: VehicleType,
) {
  return !campaign.vehicleTypes || campaign.vehicleTypes.length === 0 || campaign.vehicleTypes.includes(vehicleType);
}

function isCampaignEligible(
  campaign: DriverRidePackageCampaign,
  input: {
    packageId: string;
    vehicleType: VehicleType;
    driver?: CampaignPurchaseSource | null;
  },
) {
  if (!campaignMatchesPackage(campaign, input.packageId)) return false;
  if (campaign.campaignType === 'vehicle_type' && !campaignMatchesVehicleType(campaign, input.vehicleType)) return false;
  if (campaign.campaignType === 'first_purchase' && hasPreviousPaidPackagePurchase(input.driver)) return false;
  if (campaign.campaignType === 'referral') return false;
  return true;
}

function compareCampaigns(left: DriverRidePackageCampaign, right: DriverRidePackageCampaign) {
  const priorityDiff = CAMPAIGN_PRIORITY[right.campaignType] - CAMPAIGN_PRIORITY[left.campaignType];
  if (priorityDiff !== 0) return priorityDiff;
  return new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
}

export function getActiveDriverRideCampaigns(
  campaigns: DriverRidePackageCampaign[] = DEFAULT_CAMPAIGNS,
  now = new Date(),
) {
  return campaigns
    .filter(campaign => campaign.status === 'active' && isDateWithinCampaign(campaign, now))
    .sort(compareCampaigns);
}

export function resolvePackageOffer(input: {
  package: DriverRidePackageCatalogEntry;
  vehicleType?: VehicleType | null;
  driver?: CampaignVehicleSource | null;
  entitlement?: CampaignPurchaseSource | null;
  activeCampaigns?: DriverRidePackageCampaign[];
  now?: Date;
}): DriverRidePackageOffer {
  const now = input.now ?? new Date();
  const vehicleType = input.vehicleType ?? input.package.vehicleType ?? input.driver?.vehicleType ?? null;
  const activeCampaigns = getActiveDriverRideCampaigns(input.activeCampaigns, now);
  const purchaseSource: CampaignPurchaseSource | null = input.entitlement ?? input.driver ?? null;
  const campaign = activeCampaigns.find(candidate =>
    isCampaignEligible(candidate, {
      packageId: input.package.packageId,
      vehicleType: vehicleType ?? input.package.vehicleType,
      driver: purchaseSource,
    }),
  ) ?? null;

  const priceRwf = campaign?.priceRwf ?? input.package.priceRwf;
  const ridesGranted = campaign?.ridesGranted ?? input.package.ridesGranted;
  const bonusRidesGranted = campaign?.bonusRidesGranted ?? input.package.bonusRidesGranted;

  return {
    ...input.package,
    vehicleType,
    priceRwf,
    ridesGranted,
    bonusRidesGranted,
    basePriceRwf: input.package.priceRwf,
    baseRidesGranted: input.package.ridesGranted,
    baseBonusRidesGranted: input.package.bonusRidesGranted,
    campaignId: campaign?.campaignId ?? null,
    campaignName: campaign?.campaignName ?? null,
    campaignType: campaign?.campaignType ?? null,
    campaignStatus: campaign?.status ?? null,
    campaignDescription: campaign?.description ?? null,
    campaignBadgeLabel: campaign?.campaignName ?? null,
    isPromotional: Boolean(campaign),
  };
}

export function getPackageCampaignById(
  campaignId: string,
  campaigns: DriverRidePackageCampaign[] = DEFAULT_CAMPAIGNS,
) {
  return campaigns.find(campaign => campaign.campaignId === campaignId) ?? null;
}

export function validatePackageCampaigns(value: unknown): DriverRidePackageCampaign[] {
  if (!Array.isArray(value)) throw new Error('Package campaigns are invalid.');
  const statuses: DriverRideCampaignStatus[] = ['draft', 'scheduled', 'active', 'expired', 'archived'];
  const types: DriverRideCampaignType[] = ['global', 'vehicle_type', 'first_purchase', 'referral'];
  const vehicleTypes: VehicleType[] = ['moto', 'rifani', 'cab', 'fuso', 'hilux'];
  const valid = value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const campaign = item as Partial<DriverRidePackageCampaign>;
    return typeof campaign.campaignId === 'string'
      && campaign.campaignId.trim().length > 0
      && typeof campaign.campaignName === 'string'
      && campaign.campaignName.trim().length > 0
      && typeof campaign.campaignType === 'string'
      && types.includes(campaign.campaignType as DriverRideCampaignType)
      && typeof campaign.status === 'string'
      && statuses.includes(campaign.status as DriverRideCampaignStatus)
      && typeof campaign.startDate === 'string'
      && typeof campaign.endDate === 'string'
      && (!campaign.packageIds || campaign.packageIds.every(id => typeof id === 'string' && id.trim().length > 0))
      && (!campaign.vehicleTypes || campaign.vehicleTypes.every(type => vehicleTypes.includes(type)))
      && [campaign.priceRwf, campaign.ridesGranted, campaign.bonusRidesGranted]
        .every(number => number === undefined || (typeof number === 'number' && Number.isFinite(number) && number >= 0));
  });
  if (!valid) throw new Error('Package campaigns are invalid.');
  return value as DriverRidePackageCampaign[];
}
