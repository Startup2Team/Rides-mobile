import {
  buildCompletedRideEarningIdempotencyKey,
  hasEarningForCompletedRide,
  summarizeDriverWalletBalance,
  type DriverEarningLedgerEntry,
} from '../driverWallet';

function entry(overrides: Partial<DriverEarningLedgerEntry>): DriverEarningLedgerEntry {
  return {
    id: 'earning-1',
    driverId: 'driver-1',
    rideId: 'ride-1',
    completedAt: '2026-06-08T10:00:00.000Z',
    createdAt: '2026-06-08T10:01:00.000Z',
    grossFareRwf: 2000,
    platformFeeRwf: 0,
    netEarningRwf: 2000,
    collectionMethod: 'platform_collected',
    payoutStatus: 'pending',
    idempotencyKey: buildCompletedRideEarningIdempotencyKey('ride-1'),
    authority: 'local_prototype',
    ...overrides,
  };
}

describe('driver wallet contract helpers', () => {
  test('uses a stable idempotency key for one earning per completed ride', () => {
    expect(buildCompletedRideEarningIdempotencyKey('ride-123')).toBe('driver-earning:completed-ride:ride-123');
    expect(hasEarningForCompletedRide([entry({ rideId: 'ride-123' })], 'ride-123')).toBe(true);
    expect(hasEarningForCompletedRide([entry({ rideId: 'ride-abc' })], 'ride-123')).toBe(false);
  });

  test('summarizes platform balances separately from cash-collected activity', () => {
    const balance = summarizeDriverWalletBalance({
      driverId: 'driver-1',
      updatedAt: '2026-06-08T12:00:00.000Z',
      entries: [
        entry({ id: 'pending', rideId: 'ride-pending', netEarningRwf: 1000, payoutStatus: 'pending' }),
        entry({ id: 'available', rideId: 'ride-available', netEarningRwf: 2000, payoutStatus: 'available' }),
        entry({ id: 'paid', rideId: 'ride-paid', netEarningRwf: 3000, payoutStatus: 'paid' }),
        entry({
          id: 'cash',
          rideId: 'ride-cash',
          grossFareRwf: 1500,
          netEarningRwf: 1500,
          collectionMethod: 'cash_collected',
          payoutStatus: 'paid',
        }),
        entry({ id: 'other-driver', driverId: 'driver-2', rideId: 'ride-other', netEarningRwf: 9000 }),
      ],
    });

    expect(balance.pendingRwf).toBe(1000);
    expect(balance.availableRwf).toBe(2000);
    expect(balance.paidRwf).toBe(3000);
    expect(balance.cashCollectedRwf).toBe(1500);
    expect(balance.activityGrossRwf).toBe(7500);
  });
});
