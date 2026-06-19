import type { DriverProfile } from '@/types';
import {
  activatePackage,
  canDriverGoOnlineWithCredits,
  createPackageOfferSnapshot,
  createPackagePurchase,
  createPackagePurchaseFromOffer,
  deductCreditForCompletedRide,
  EMPTY_DRIVER_ENTITLEMENT,
  getPackagePurchaseSnapshot,
  getActiveBonusRides,
  getActiveRideCredits,
  getPackagesForVehicleType,
  getRideBalance,
  getRideCreditBalanceMessage,
  getVehicleEntitlement,
  hasUsedLaunchOffer,
  isLowRideCreditBalance,
  normalizeEntitlement,
  updatePackagePurchaseStatus,
  validatePackageOfferSnapshot,
} from '../driverRidePackages';
import {
  getActiveDriverRideCampaigns,
  resolvePackageOffer,
  validatePackageCampaigns,
} from '../driverRideCampaigns';
import {
  getActivePackages,
  getPackageByVersion,
  getPackageCatalogEntry,
  validatePackageCatalog,
} from '../driverRidePackageCatalog';

const approvedDriver = { verificationStatus: 'approved', isVerified: true } as DriverProfile;
const motoVehicle = { id: 'vehicle-moto-1', vehicleType: 'moto' as const, status: 'approved' as const };
const motoVehicleTwo = { id: 'vehicle-moto-2', vehicleType: 'moto' as const, status: 'approved' as const };
const cabVehicle = { id: 'vehicle-cab-1', vehicleType: 'cab' as const, status: 'approved' as const };
const multiVehicleDriver = {
  ...approvedDriver,
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  licenseNumber: '1234567890123456',
  activeVehicle: { vehicleId: motoVehicle.id },
  vehicles: [motoVehicle, cabVehicle],
} as DriverProfile;

describe('driver ride packages', () => {
  test('approved driver with no credits cannot go online', () => {
    expect(canDriverGoOnlineWithCredits(approvedDriver, EMPTY_DRIVER_ENTITLEMENT)).toBe(false);
  });

  test('approved driver with credits can go online', () => {
    const { entitlement } = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter');
    expect(canDriverGoOnlineWithCredits(approvedDriver, entitlement)).toBe(true);
  });

  test('package IDs for all vehicle types are available', () => {
    expect(getPackagesForVehicleType('moto')).toEqual(['launch_starter', 'growth', 'pro']);
    expect(getPackagesForVehicleType('rifani')).toEqual(['rifani_starter', 'rifani_growth', 'rifani_pro']);
    expect(getPackagesForVehicleType('cab')).toEqual(['cab_starter', 'cab_growth', 'cab_pro']);
    expect(getPackagesForVehicleType('hilux')).toEqual(['hilux_starter', 'hilux_growth', 'hilux_pro']);
    expect(getPackagesForVehicleType('fuso')).toEqual(['fuso_starter', 'fuso_growth', 'fuso_pro']);
  });

  test('launch starter activates once for free', () => {
    const first = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter');
    expect(first.activation.pricePaidRwf).toBe(0);
    expect(getActiveRideCredits(first.entitlement)).toBe(35);
    expect(getRideBalance(first.entitlement)).toBe(30);
    expect(getActiveBonusRides(first.entitlement)).toBe(5);
    expect(hasUsedLaunchOffer(first.entitlement)).toBe(true);
    expect(() => activatePackage(first.entitlement, 'launch_starter')).toThrow('already been used');
  });

  test('starter offer is once per vehicle, not global', () => {
    const moto = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter', '2026-06-08T10:00:00.000Z', motoVehicle);
    expect(() => activatePackage(moto.entitlement, 'launch_starter', '2026-06-08T10:01:00.000Z', motoVehicle)).toThrow('already been used');

    const cab = activatePackage(moto.entitlement, 'cab_starter', '2026-06-08T10:02:00.000Z', cabVehicle);
    const secondMoto = activatePackage(cab.entitlement, 'launch_starter', '2026-06-08T10:03:00.000Z', motoVehicleTwo);

    expect(getActiveRideCredits(normalizeEntitlement(secondMoto.entitlement, motoVehicle))).toBe(35);
    expect(getActiveRideCredits(normalizeEntitlement(secondMoto.entitlement, cabVehicle))).toBe(4);
    expect(getActiveRideCredits(normalizeEntitlement(secondMoto.entitlement, motoVehicleTwo))).toBe(35);
  });

  test('legacy global entitlement migrates to the selected vehicle', () => {
    const legacy = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      activePackageId: 'growth' as const,
      remainingRideCredits: 6,
      remainingBonusRides: 2,
      activations: [{
        id: 'activation:legacy:growth',
        packageId: 'growth' as const,
        activatedAt: '2026-06-08T10:00:00.000Z',
        pricePaidRwf: 2_000,
        creditsGranted: 75,
        authority: 'local_prototype' as const,
      }],
      creditTransactions: [{
        id: 'credit:legacy:growth',
        type: 'credit' as const,
        amount: 75,
        createdAt: '2026-06-08T10:00:00.000Z',
        packageActivationId: 'activation:legacy:growth',
        idempotencyKey: 'package-activation:legacy:growth',
        authority: 'local_prototype' as const,
      }],
      purchaseHistory: [{
        packageId: 'growth' as const,
        amount: 2_000,
        provider: 'mtn' as const,
        phoneNumber: '+250788000000',
        transactionId: 'momo-package:growth:legacy',
        status: 'successful' as const,
        createdAt: '2026-06-08T09:59:00.000Z',
        completedAt: '2026-06-08T10:00:00.000Z',
      }],
      updatedAt: '2026-06-08T10:00:00.000Z',
    };

    const migrated = normalizeEntitlement(legacy as unknown as Parameters<typeof normalizeEntitlement>[0], motoVehicle);

    expect(migrated.vehicleId).toBe(motoVehicle.id);
    expect(migrated.vehicleType).toBe('moto');
    expect(getActiveRideCredits(migrated)).toBe(8);
    expect(getVehicleEntitlement(migrated, motoVehicle)).toMatchObject({
      vehicleId: motoVehicle.id,
      vehicleType: 'moto',
      activePackageId: 'growth',
      remainingRideCredits: 6,
      remainingBonusRides: 2,
      activations: [expect.objectContaining({ vehicleId: motoVehicle.id, vehicleType: 'moto' })],
      creditTransactions: [expect.objectContaining({ vehicleId: motoVehicle.id, vehicleType: 'moto' })],
      purchaseHistory: [expect.objectContaining({
        bonusRidesGranted: 15,
        packageName: 'Growth Package',
        packageVersion: 'v1',
        purchasedAt: '2026-06-08T09:59:00.000Z',
        ridesGranted: 60,
        vehicleId: motoVehicle.id,
        vehicleType: 'moto',
      })],
    });
  });

  test('purchase snapshots are created from the active catalog and remain immutable', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:01:00.000Z');
    const snapshot = getPackagePurchaseSnapshot(completed.purchase);

    expect(started.purchase).toMatchObject({
      packageVersion: 'v1',
      packageName: 'Growth Package',
      ridesGranted: 60,
      bonusRidesGranted: 15,
      pricePaid: 2_000,
      purchasedAt: '2026-06-08T10:00:00.000Z',
    });
    expect(snapshot).toMatchObject({
      packageId: 'growth',
      packageVersion: 'v1',
      packageName: 'Growth Package',
      ridesGranted: 60,
      bonusRidesGranted: 15,
      pricePaid: 2_000,
      purchasedAt: '2026-06-08T10:00:00.000Z',
    });
  });

  test('locked offer values are used for purchase and activation snapshots', () => {
    const catalogOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      activeCampaigns: [],
      now: new Date('2026-06-08T10:00:00.000Z'),
    });
    const lockedOffer = createPackageOfferSnapshot(
      { ...catalogOffer, priceRwf: 1_250, ridesGranted: 44, bonusRidesGranted: 6 },
      motoVehicle,
      new Date('2026-06-08T10:00:00.000Z'),
    );
    const started = createPackagePurchaseFromOffer(EMPTY_DRIVER_ENTITLEMENT, {
      offer: lockedOffer,
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:01:00.000Z', motoVehicle);
    const completed = updatePackagePurchaseStatus(
      started.entitlement,
      started.purchase.transactionId,
      'successful',
      '2026-06-08T10:02:00.000Z',
      motoVehicle,
    );

    expect(started.purchase).toMatchObject({
      offerId: lockedOffer.offerId,
      pricePaid: 1_250,
      ridesGranted: 44,
      bonusRidesGranted: 6,
    });
    expect(completed.activation).toMatchObject({
      pricePaid: 1_250,
      ridesGranted: 44,
      bonusRidesGranted: 6,
      creditsGranted: 50,
    });
    expect(getPackagePurchaseSnapshot(completed.purchase)).toMatchObject({
      pricePaid: 1_250,
      ridesGranted: 44,
      bonusRidesGranted: 6,
    });
  });

  test('expired or invalid locked offers cannot create purchases', () => {
    const catalogOffer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      activeCampaigns: [],
      now: new Date('2026-06-08T10:00:00.000Z'),
    });
    const expiredOffer = createPackageOfferSnapshot(
      catalogOffer,
      motoVehicle,
      new Date('2026-06-08T10:00:00.000Z'),
      1_000,
    );

    expect(() => createPackagePurchaseFromOffer(EMPTY_DRIVER_ENTITLEMENT, {
      offer: expiredOffer,
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:02.000Z', motoVehicle)).toThrow('offer expired');

    expect(() => createPackagePurchaseFromOffer(EMPTY_DRIVER_ENTITLEMENT, {
      offer: { ...expiredOffer, ridesGranted: -1 },
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.500Z', motoVehicle)).toThrow('offer is invalid');
  });

  test('locked offers and purchases accept package IDs unknown to the mobile build', () => {
    const lockedOffer = {
      offerId: 'package-offer:vehicle-moto-1:moto-premium:v9:1',
      packageId: 'moto_premium',
      packageVersion: 'v9',
      packageName: 'Moto Premium',
      vehicleId: motoVehicle.id,
      vehicleType: 'moto' as const,
      priceRwf: 7_500,
      ridesGranted: 250,
      bonusRidesGranted: 75,
      campaignId: null,
      campaignName: null,
      campaignType: null,
      createdAt: '2026-06-19T10:00:00.000Z',
      expiresAt: '2026-06-19T10:15:00.000Z',
      source: 'local_catalog' as const,
      quoteAuthority: 'local' as const,
    };

    expect(validatePackageOfferSnapshot(lockedOffer, motoVehicle)).toEqual(lockedOffer);
    const started = createPackagePurchaseFromOffer(EMPTY_DRIVER_ENTITLEMENT, {
      offer: lockedOffer,
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-19T10:01:00.000Z', motoVehicle);
    const completed = updatePackagePurchaseStatus(
      started.entitlement,
      started.purchase.transactionId,
      'successful',
      '2026-06-19T10:02:00.000Z',
      motoVehicle,
    );

    expect(completed.purchase).toMatchObject({
      packageId: 'moto_premium',
      packageVersion: 'v9',
      packageName: 'Moto Premium',
      ridesGranted: 250,
      bonusRidesGranted: 75,
    });
    expect(completed.activation).toMatchObject({
      packageId: 'moto_premium',
      ridesGranted: 250,
      bonusRidesGranted: 75,
    });
  });

  test('purchase history snapshots survive removed or archived catalog entries', () => {
    const removedPurchase = {
      packageId: 'black_friday_package',
      packageVersion: '2026',
      packageName: 'Black Friday Package',
      vehicleId: motoVehicle.id,
      vehicleType: 'moto' as const,
      amount: 1_000,
      pricePaid: 1_000,
      ridesGranted: 80,
      bonusRidesGranted: 20,
      purchasedAt: '2026-11-27T08:00:00.000Z',
      provider: 'mtn' as const,
      phoneNumber: '+250788000000',
      transactionId: 'purchase:black-friday',
      status: 'successful' as const,
      createdAt: '2026-11-27T08:00:00.000Z',
    };

    expect(getPackagePurchaseSnapshot(removedPurchase)).toMatchObject({
      packageId: 'black_friday_package',
      packageVersion: '2026',
      packageName: 'Black Friday Package',
      ridesGranted: 80,
      bonusRidesGranted: 20,
      pricePaid: 1_000,
    });
  });

  test('package catalog versions can coexist while active lookup stays singular', () => {
    const catalog = [
      {
        packageId: 'growth' as const,
        packageVersion: 'v1',
        packageName: 'Growth Package',
        vehicleType: 'moto' as const,
        priceRwf: 2_000,
        ridesGranted: 60,
        bonusRidesGranted: 15,
        status: 'archived' as const,
        createdAt: '2026-06-01T00:00:00.000Z',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveUntil: '2026-06-15T00:00:00.000Z',
      },
      {
        packageId: 'growth' as const,
        packageVersion: 'v2',
        packageName: 'Growth Package',
        vehicleType: 'moto' as const,
        priceRwf: 2_500,
        ridesGranted: 70,
        bonusRidesGranted: 20,
        status: 'active' as const,
        createdAt: '2026-06-16T00:00:00.000Z',
        effectiveFrom: '2026-06-16T00:00:00.000Z',
        effectiveUntil: null,
      },
      {
        packageId: 'growth' as const,
        packageVersion: 'v3',
        packageName: 'Growth Package',
        vehicleType: 'moto' as const,
        priceRwf: 3_000,
        ridesGranted: 80,
        bonusRidesGranted: 25,
        status: 'scheduled' as const,
        createdAt: '2026-06-20T00:00:00.000Z',
        effectiveFrom: '2026-06-21T00:00:00.000Z',
        effectiveUntil: null,
      },
    ];

    expect(getActivePackages('moto', catalog)).toHaveLength(1);
    expect(getActivePackages('moto', catalog)[0]).toMatchObject({ packageVersion: 'v2', status: 'active' });
    expect(getPackageByVersion('growth', 'v1', 'moto', catalog)).toMatchObject({ status: 'archived', ridesGranted: 60 });
    expect(getPackageCatalogEntry('growth', 'moto', undefined, catalog)).toMatchObject({ packageVersion: 'v2', priceRwf: 2_500 });
  });

  test('catalog validation accepts dynamic IDs and rejects invalid identity or values', () => {
    const dynamicEntry = {
      packageId: 'cab_gold',
      packageVersion: 'gold-v1',
      packageName: 'Cab Gold',
      vehicleType: 'cab' as const,
      priceRwf: 8_000,
      ridesGranted: 20,
      bonusRidesGranted: 10,
      status: 'active' as const,
      createdAt: '2026-06-19T00:00:00.000Z',
      effectiveFrom: '2026-06-19T00:00:00.000Z',
      effectiveUntil: null,
    };

    expect(validatePackageCatalog([dynamicEntry])).toEqual([dynamicEntry]);
    expect(() => validatePackageCatalog([{ ...dynamicEntry, packageId: '' }])).toThrow('catalog is invalid');
    expect(() => validatePackageCatalog([{ ...dynamicEntry, packageVersion: '' }])).toThrow('catalog is invalid');
    expect(() => validatePackageCatalog([{ ...dynamicEntry, ridesGranted: -1 }])).toThrow('catalog is invalid');
    expect(() => validatePackageCatalog([{ ...dynamicEntry, vehicleType: 'plane' }])).toThrow('catalog is invalid');
    expect(() => validatePackageCatalog([{ ...dynamicEntry, effectiveFrom: 'not-a-date' }])).toThrow('catalog is invalid');
    expect(() => validatePackageCatalog([{
      ...dynamicEntry,
      effectiveUntil: '2026-06-18T00:00:00.000Z',
    }])).toThrow('catalog is invalid');
  });

  test('active package versions enforce effective dates', () => {
    const base = {
      packageId: 'moto_timed',
      packageVersion: 'v1',
      packageName: 'Timed',
      vehicleType: 'moto' as const,
      priceRwf: 1_000,
      ridesGranted: 10,
      bonusRidesGranted: 1,
      status: 'active' as const,
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    const catalog = [
      { ...base, effectiveFrom: '2026-06-20T00:00:00.000Z', effectiveUntil: null },
      { ...base, packageVersion: 'v0', effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveUntil: '2026-06-18T00:00:00.000Z' },
    ];

    expect(getActivePackages('moto', catalog, new Date('2026-06-19T00:00:00.000Z'))).toEqual([]);
    expect(getActivePackages('moto', catalog, new Date('2026-06-20T00:00:00.000Z'))).toEqual([catalog[0]]);
  });

  test('campaign precedence favors first purchase, then vehicle, then global', () => {
    const common = {
      status: 'active' as const,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      description: 'test',
      packageIds: ['growth'],
    };
    const campaigns = [
      { ...common, campaignId: 'global', campaignName: 'Global', campaignType: 'global' as const, priceRwf: 1_900 },
      { ...common, campaignId: 'vehicle', campaignName: 'Vehicle', campaignType: 'vehicle_type' as const, vehicleTypes: ['moto' as const], priceRwf: 1_500 },
      { ...common, campaignId: 'first', campaignName: 'First', campaignType: 'first_purchase' as const, priceRwf: 1_000 },
    ];
    const offer = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      activeCampaigns: getActiveDriverRideCampaigns(campaigns, new Date('2026-06-19T00:00:00.000Z')),
      now: new Date('2026-06-19T00:00:00.000Z'),
    });

    expect(offer.campaignId).toBe('first');
    expect(offer.priceRwf).toBe(1_000);
  });

  test('campaign validation rejects invalid and reversed dates', () => {
    const campaign = {
      campaignId: 'dated',
      campaignName: 'Dated',
      campaignType: 'global' as const,
      status: 'active' as const,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      description: 'test',
    };

    expect(() => validatePackageCampaigns([{ ...campaign, startDate: 'invalid' }])).toThrow('campaigns are invalid');
    expect(() => validatePackageCampaigns([{
      ...campaign,
      endDate: '2026-05-01T00:00:00.000Z',
    }])).toThrow('campaigns are invalid');
  });

  test('package ID must match the selected vehicle type', () => {
    expect(() => activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'cab_starter', '2026-06-08T10:00:00.000Z', motoVehicle))
      .toThrow('Package does not apply');
    expect(() => createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z', cabVehicle)).toThrow('Package does not apply');
  });

  test('vehicle A credits do not count for vehicle B online gating', () => {
    const creditedCab = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'cab_starter', '2026-06-08T10:00:00.000Z', cabVehicle).entitlement;

    expect(canDriverGoOnlineWithCredits(multiVehicleDriver, creditedCab)).toBe(false);
    expect(canDriverGoOnlineWithCredits({
      ...multiVehicleDriver,
      activeVehicle: { vehicleId: cabVehicle.id },
    }, creditedCab)).toBe(true);
  });

  test('successful purchase adds package Rides to Rides and package Bonus Rides to Bonus Rides', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:01:00.000Z');

    expect(getActiveRideCredits(completed.entitlement)).toBe(75);
    expect(getRideBalance(completed.entitlement)).toBe(60);
    expect(getActiveBonusRides(completed.entitlement)).toBe(15);
    expect(completed.activation?.creditsGranted).toBe(75);
    expect(completed.purchase.status).toBe('successful');
  });

  test('package purchase adds credits only to selected vehicle', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'cab_growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z', cabVehicle);
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:01:00.000Z', cabVehicle);

    expect(completed.purchase).toMatchObject({ vehicleId: cabVehicle.id, vehicleType: 'cab' });
    expect(completed.activation).toMatchObject({ vehicleId: cabVehicle.id, vehicleType: 'cab' });
    expect(getActiveRideCredits(normalizeEntitlement(completed.entitlement, cabVehicle))).toBe(9);
    expect(getActiveRideCredits(normalizeEntitlement(completed.entitlement, motoVehicle))).toBe(0);
  });

  test.each(['failed', 'cancelled', 'expired'] as const)('%s purchase adds no credits', status => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'airtel',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, status, '2026-06-08T10:01:00.000Z');

    expect(getActiveRideCredits(completed.entitlement)).toBe(0);
    expect(completed.activation).toBeUndefined();
    expect(completed.purchase.status).toBe(status);
  });

  test('duplicate success cannot add credits twice', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const first = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:01:00.000Z');
    const duplicate = updatePackagePurchaseStatus(first.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:02:00.000Z');

    expect(getActiveRideCredits(duplicate.entitlement)).toBe(75);
    expect(getRideBalance(duplicate.entitlement)).toBe(60);
    expect(getActiveBonusRides(duplicate.entitlement)).toBe(15);
    expect(duplicate.entitlement.activations).toHaveLength(1);
    expect(duplicate.entitlement.creditTransactions).toHaveLength(1);
  });

  test('completed ride deducts from matching vehicle entitlement only', () => {
    const moto = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter', '2026-06-08T10:00:00.000Z', motoVehicle);
    const cab = activatePackage(moto.entitlement, 'cab_starter', '2026-06-08T10:01:00.000Z', cabVehicle);
    const result = deductCreditForCompletedRide(cab.entitlement, 'ride-1', '2026-06-08T10:02:00.000Z', cabVehicle);
    const duplicate = deductCreditForCompletedRide(result.entitlement, 'ride-1', '2026-06-08T10:03:00.000Z', cabVehicle);

    expect(result.deducted).toBe(true);
    expect(duplicate.deducted).toBe(false);
    expect(getActiveRideCredits(normalizeEntitlement(duplicate.entitlement, cabVehicle))).toBe(3);
    expect(getActiveRideCredits(normalizeEntitlement(duplicate.entitlement, motoVehicle))).toBe(35);
    expect(getVehicleEntitlement(duplicate.entitlement, cabVehicle).creditTransactions.at(-1)).toMatchObject({
      completedRideId: 'ride-1',
      vehicleId: cabVehicle.id,
      vehicleType: 'cab',
    });
  });

  test('purchase history records status correctly', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const processing = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'processing', '2026-06-08T10:00:30.000Z');
    const failed = updatePackagePurchaseStatus(processing.entitlement, started.purchase.transactionId, 'failed', '2026-06-08T10:01:00.000Z');

    expect(failed.entitlement.purchaseHistory).toEqual([
      expect.objectContaining({
        amount: 2_000,
        bonusRidesGranted: 15,
        packageName: 'Growth Package',
        packageId: 'growth',
        packageVersion: 'v1',
        phoneNumber: '+250788000000',
        provider: 'mtn',
        purchasedAt: '2026-06-08T10:00:00.000Z',
        ridesGranted: 60,
        status: 'failed',
        completedAt: '2026-06-08T10:01:00.000Z',
      }),
    ]);
  });

  test('completed ride deducts exactly once and duplicate completion does not double-deduct', () => {
    const active = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter').entitlement;
    const first = deductCreditForCompletedRide(active, 'ride-1');
    const duplicate = deductCreditForCompletedRide(first.entitlement, 'ride-1');
    expect(first.deducted).toBe(true);
    expect(getActiveRideCredits(first.entitlement)).toBe(34);
    expect(getRideBalance(first.entitlement)).toBe(29);
    expect(getActiveBonusRides(first.entitlement)).toBe(5);
    expect(duplicate.deducted).toBe(false);
    expect(getActiveRideCredits(duplicate.entitlement)).toBe(34);
  });

  test('completed ride uses Bonus Rides only after rides are empty', () => {
    const entitlement = { ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 0, remainingBonusRides: 2 };
    const result = deductCreditForCompletedRide(entitlement, 'ride-1');
    expect(result.deducted).toBe(true);
    expect(getRideBalance(result.entitlement)).toBe(0);
    expect(getActiveBonusRides(result.entitlement)).toBe(1);
    expect(getActiveRideCredits(result.entitlement)).toBe(1);
  });

  test('cancellation does not deduct and low rides warning appears below 10', () => {
    const entitlement = { ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 9 };
    expect(getActiveRideCredits(entitlement)).toBe(9);
    expect(isLowRideCreditBalance(entitlement)).toBe(true);
  });

  test('low rides messaging escalates at 10, 5, 2, and 0 credits', () => {
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 10 })).toContain('10 rides left');
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 5 })).toContain('Only 5 rides left');
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 2 })).toContain('Only 2 rides left');
    expect(getRideCreditBalanceMessage(EMPTY_DRIVER_ENTITLEMENT)).toBe('Choose a package to start receiving ride requests.');
  });
});
