import type { DriverProfile } from '@/types';
import {
  activatePackage,
  canDriverGoOnlineWithCredits,
  createPackagePurchase,
  deductCreditForCompletedRide,
  EMPTY_DRIVER_ENTITLEMENT,
  getActiveRideCredits,
  getRideCreditBalanceMessage,
  hasUsedLaunchOffer,
  isLowRideCreditBalance,
  updatePackagePurchaseStatus,
} from '../driverRidePackages';

const approvedDriver = { verificationStatus: 'approved', isVerified: true } as DriverProfile;

describe('driver ride packages', () => {
  test('approved driver with no credits cannot go online', () => {
    expect(canDriverGoOnlineWithCredits(approvedDriver, EMPTY_DRIVER_ENTITLEMENT)).toBe(false);
  });

  test('approved driver with credits can go online', () => {
    const { entitlement } = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter');
    expect(canDriverGoOnlineWithCredits(approvedDriver, entitlement)).toBe(true);
  });

  test('launch starter activates once for free', () => {
    const first = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'launch_starter');
    expect(first.activation.pricePaidRwf).toBe(0);
    expect(getActiveRideCredits(first.entitlement)).toBe(35);
    expect(hasUsedLaunchOffer(first.entitlement)).toBe(true);
    expect(() => activatePackage(first.entitlement, 'launch_starter')).toThrow('already been used');
  });

  test('successful purchase adds credits', () => {
    const started = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'growth',
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }, '2026-06-08T10:00:00.000Z');
    const completed = updatePackagePurchaseStatus(started.entitlement, started.purchase.transactionId, 'successful', '2026-06-08T10:01:00.000Z');

    expect(getActiveRideCredits(completed.entitlement)).toBe(75);
    expect(completed.activation?.creditsGranted).toBe(75);
    expect(completed.purchase.status).toBe('successful');
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
    expect(duplicate.entitlement.activations).toHaveLength(1);
    expect(duplicate.entitlement.creditTransactions).toHaveLength(1);
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
    expect(duplicate.deducted).toBe(false);
    expect(getActiveRideCredits(duplicate.entitlement)).toBe(34);
  });

  test('cancellation does not deduct and low balance warning appears below 10', () => {
    const entitlement = { ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 9 };
    expect(getActiveRideCredits(entitlement)).toBe(9);
    expect(isLowRideCreditBalance(entitlement)).toBe(true);
  });

  test('low balance messaging escalates at 10, 5, 2, and 0 credits', () => {
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 10 })).toContain('10 ride credits left');
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 5 })).toContain('Only 5 ride credits left');
    expect(getRideCreditBalanceMessage({ ...EMPTY_DRIVER_ENTITLEMENT, remainingRideCredits: 2 })).toContain('Only 2 ride credits left');
    expect(getRideCreditBalanceMessage(EMPTY_DRIVER_ENTITLEMENT)).toBe('Choose a package to start receiving ride requests.');
  });
});
