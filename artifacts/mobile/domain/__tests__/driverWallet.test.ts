import {
  buildCompletedRideEarningIdempotencyKey,
  buildDriverRatingIdempotencyKey,
  formatDriverRatingSummary,
  getDriverRatingSummary,
  hasEarningForCompletedRide,
  hasRatingForCompletedRide,
  summarizeDriverWalletBalance,
  type DriverEarningLedgerEntry,
  type DriverRating,
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

function rating(overrides: Partial<DriverRating>): DriverRating {
  return {
    id: 'rating-1',
    rideId: 'ride-1',
    driverId: 'driver-1',
    customerId: 'customer-1',
    stars: 5,
    reviewText: 'Great trip',
    moderationStatus: 'published',
    createdAt: '2026-06-08T10:01:00.000Z',
    idempotencyKey: buildDriverRatingIdempotencyKey('ride-1'),
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

  test('prevents duplicate ratings for one completed ride', () => {
    expect(buildDriverRatingIdempotencyKey('ride-123')).toBe('driver-rating:completed-ride:ride-123');
    expect(hasRatingForCompletedRide([rating({ rideId: 'ride-123' })], 'ride-123')).toBe(true);
    expect(hasRatingForCompletedRide([rating({ rideId: 'ride-abc' })], 'ride-123')).toBe(false);
  });

  test('calculates and formats driver rating averages', () => {
    const summary = getDriverRatingSummary([
      rating({ id: 'rating-1', rideId: 'ride-1', stars: 5 }),
      rating({ id: 'rating-2', rideId: 'ride-2', stars: 4 }),
      rating({ id: 'rating-3', rideId: 'ride-3', driverId: 'driver-2', stars: 1 }),
    ], 'driver-1');

    expect(summary).toEqual({ averageRating: 4.5, ratingCount: 2 });
    expect(formatDriverRatingSummary(summary)).toBe('4.5 (2)');
    expect(formatDriverRatingSummary(getDriverRatingSummary([], 'driver-1'))).toBe('No ratings yet');
  });
});
