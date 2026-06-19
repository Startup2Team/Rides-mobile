import type { DriverRidePackageCampaign } from '../driverRideCampaigns';
import { resolvePackageOffer } from '../driverRideCampaigns';
import { getPackageCatalogEntry } from '../driverRidePackageCatalog';
import {
  createPackagePurchase,
  EMPTY_DRIVER_ENTITLEMENT,
  getPackagePurchaseSnapshot,
  updatePackagePurchaseStatus,
} from '../driverRidePackages';

const motoVehicle = { id: 'vehicle-moto-1', vehicleType: 'moto' as const };
const cabVehicle = { id: 'vehicle-cab-1', vehicleType: 'cab' as const };

function makeCampaign(overrides: Partial<DriverRidePackageCampaign> = {}): DriverRidePackageCampaign {
  return {
    campaignId: 'world-cup',
    campaignName: 'World Cup',
    campaignType: 'global',
    status: 'active',
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    description: 'Temporary promotion',
    packageIds: ['growth'],
    priceRwf: 1_500,
    ridesGranted: 40,
    bonusRidesGranted: 5,
    ...overrides,
  };
}

describe('driver ride campaigns', () => {
  test('campaign overrides package values', () => {
    const offer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [makeCampaign()],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(offer).toMatchObject({
      campaignId: 'world-cup',
      campaignName: 'World Cup',
      priceRwf: 1_500,
      ridesGranted: 40,
      bonusRidesGranted: 5,
      basePriceRwf: 2_000,
      isPromotional: true,
    });
  });

  test('inactive campaign is ignored', () => {
    const offer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [makeCampaign({ status: 'draft' })],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(offer).toMatchObject({
      campaignId: null,
      priceRwf: 2_000,
      ridesGranted: 60,
      bonusRidesGranted: 15,
      isPromotional: false,
    });
  });

  test('expired campaign is ignored', () => {
    const offer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [makeCampaign({ status: 'active', endDate: '2026-06-01T00:00:00.000Z' })],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(offer).toMatchObject({
      campaignId: null,
      priceRwf: 2_000,
      ridesGranted: 60,
      bonusRidesGranted: 15,
    });
  });

  test('vehicle campaign only affects matching vehicle type', () => {
    const campaign = makeCampaign({
      campaignType: 'vehicle_type',
      vehicleTypes: ['cab'],
      packageIds: ['cab_growth'],
      priceRwf: 1_250,
      ridesGranted: 3,
      bonusRidesGranted: 2,
    });

    const motoOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [campaign],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });
    const cabOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('cab_growth', 'cab')!,
      vehicleType: 'cab',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [campaign],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(motoOffer).toMatchObject({ campaignId: null, priceRwf: 2_000, ridesGranted: 60 });
    expect(cabOffer).toMatchObject({ campaignId: 'world-cup', priceRwf: 1_250, ridesGranted: 3, bonusRidesGranted: 2 });
  });

  test('first purchase campaign applies only before the first paid package', () => {
    const firstPurchaseCampaign = makeCampaign({
      campaignType: 'first_purchase',
      priceRwf: 900,
      ridesGranted: 20,
      bonusRidesGranted: 5,
    });

    const eligibleOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [firstPurchaseCampaign],
      now: new Date('2026-06-15T00:00:00.000Z'),
    });
    expect(eligibleOffer).toMatchObject({
      campaignId: 'world-cup',
      priceRwf: 900,
      ridesGranted: 20,
      bonusRidesGranted: 5,
    });

    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-15T00:00:00.000Z', motoVehicle, [firstPurchaseCampaign]);
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-15T00:01:00.000Z', motoVehicle);
    const blockedOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: completed.entitlement,
      activeCampaigns: [firstPurchaseCampaign],
      now: new Date('2026-06-15T00:02:00.000Z'),
    });

    expect(blockedOffer).toMatchObject({
      campaignId: null,
      priceRwf: 2_000,
      ridesGranted: 60,
      bonusRidesGranted: 15,
    });
  });

  test('purchase snapshot stores campaign data and remains immutable', () => {
    const campaign = makeCampaign();
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-15T00:00:00.000Z', motoVehicle, [campaign]);
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-15T00:01:00.000Z', motoVehicle);
    const snapshot = getPackagePurchaseSnapshot(completed.purchase);

    expect(completed.purchase).toMatchObject({
      campaignId: 'world-cup',
      campaignName: 'World Cup',
      pricePaid: 1_500,
      ridesGranted: 40,
      bonusRidesGranted: 5,
      packageVersion: 'v1',
    });
    expect(snapshot).toMatchObject({
      campaignId: 'world-cup',
      campaignName: 'World Cup',
      pricePaid: 1_500,
      ridesGranted: 40,
      bonusRidesGranted: 5,
    });

    const laterOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      driver: EMPTY_DRIVER_ENTITLEMENT,
      activeCampaigns: [makeCampaign({ campaignId: 'spring-sale', campaignName: 'Spring Sale', priceRwf: 1_000, ridesGranted: 30, bonusRidesGranted: 3 })],
      now: new Date('2026-06-20T00:00:00.000Z'),
    });

    expect(laterOffer).toMatchObject({
      campaignId: 'spring-sale',
      priceRwf: 1_000,
      ridesGranted: 30,
      bonusRidesGranted: 3,
    });
    expect(getPackagePurchaseSnapshot(completed.purchase)).toMatchObject({
      campaignId: 'world-cup',
      pricePaid: 1_500,
      ridesGranted: 40,
      bonusRidesGranted: 5,
    });
  });
});
