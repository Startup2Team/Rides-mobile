import type { DriverProfile } from '@/types';
import {
  activatePackage,
  canDriverGoOnlineWithCredits,
  createPackagePurchase,
  deductCreditForCompletedRide,
  EMPTY_DRIVER_ENTITLEMENT,
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
} from '../driverRidePackages';

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
      purchaseHistory: [expect.objectContaining({ vehicleId: motoVehicle.id, vehicleType: 'moto' })],
    });
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
        packageId: 'growth',
        phoneNumber: '+250788000000',
        provider: 'mtn',
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
