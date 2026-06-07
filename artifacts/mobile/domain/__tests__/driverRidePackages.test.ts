import type { DriverProfile } from '@/types';
import {
  activatePackage,
  canDriverGoOnlineWithCredits,
  deductCreditForCompletedRide,
  EMPTY_DRIVER_ENTITLEMENT,
  getActiveRideCredits,
  hasUsedLaunchOffer,
  isLowRideCreditBalance,
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

  test('growth package adds 75 credits', () => {
    expect(getActiveRideCredits(activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'growth').entitlement)).toBe(75);
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
});
