import { EMPTY_DRIVER_ENTITLEMENT, type DriverEntitlement } from '@/domain/driverRidePackages';
import {
  createDriverStatisticsViewModel,
  getCompletedTripsSeries,
  getDriverStatisticsPeriodWindow,
  getDriverStatisticsSparseLabels,
  getEarningsPerTripSeries,
  type DriverStatisticsPeriod,
} from '@/domains/driver-statistics';
import type { DriverProfile, Ride } from '@/types';

const NOW = new Date(2026, 6, 8, 14, 30, 0, 0);

const profile: DriverProfile = {
  acceptanceRate: 75,
  city: 'Kigali',
  completedRides: 12,
  dailyDeclines: 2,
  dailyRides: 6,
  district: 'Gasabo',
  dob: '1990-01-01',
  earningsTotal: 24_000,
  isOnline: false,
  isVerified: true,
  licenseNumber: 'DL123',
  momoCode: '+250788000000',
  momoProvider: 'mtn',
  nationalId: '1199000000000000',
  plateNumber: 'RAD 001 A',
  policyAccepted: true,
  province: 'Kigali',
  sector: 'Kimironko',
  vehicleType: 'moto',
  verificationStatus: 'approved',
};

function ride(overrides: Partial<Ride>): Ride {
  return {
    agreedFare: 1_000,
    completedAt: new Date(2026, 6, 8, 9, 0).toISOString(),
    createdAt: new Date(2026, 6, 8, 8, 30).toISOString(),
    customerId: 'customer-1',
    destination: { address: 'Destination', latitude: -1.95, longitude: 30.08 },
    distance: 4,
    driverId: 'driver-1',
    duration: 12,
    id: 'ride-1',
    negotiation: [],
    pickup: { address: 'Pickup', latitude: -1.94, longitude: 30.06 },
    status: 'completed',
    suggestedFare: 900,
    vehicleType: 'moto',
    ...overrides,
  };
}

function entitlement(overrides: Partial<DriverEntitlement> = {}): DriverEntitlement {
  return {
    ...EMPTY_DRIVER_ENTITLEMENT,
    remainingBonusRides: 3,
    remainingRideCredits: 8,
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function viewModel({
  period = 'today',
  rideHistory = [],
  driverEntitlement = entitlement(),
  driverProfile = profile,
}: {
  period?: DriverStatisticsPeriod;
  rideHistory?: Ride[];
  driverEntitlement?: DriverEntitlement;
  driverProfile?: DriverProfile | null;
} = {}) {
  return createDriverStatisticsViewModel({
    currentDriverId: 'driver-1',
    driverEntitlement,
    driverProfile,
    driverRatingSummary: { averageRating: 4.5, ratingCount: 2 },
    now: NOW,
    rideHistory,
    selectedPeriod: period,
  });
}

describe('driver statistics periods', () => {
  test('creates deterministic today range with hourly buckets', () => {
    const period = getDriverStatisticsPeriodWindow('today', NOW);
    expect(new Date(period.startAt).getHours()).toBe(0);
    expect(new Date(period.startAt).getDate()).toBe(NOW.getDate());
    expect(new Date(period.endAt).getHours()).toBe(23);
    expect(period.label).toBe('Today');
    expect(period.bucketGranularity).toBe('hour');
  });

  test('creates deterministic week range with daily buckets', () => {
    const period = getDriverStatisticsPeriodWindow('week', NOW);
    expect(new Date(period.startAt).getDay()).toBe(1);
    expect(new Date(period.endAt).getDay()).toBe(0);
    expect(period.bucketGranularity).toBe('day');
  });

  test('creates deterministic month range with daily buckets', () => {
    const period = getDriverStatisticsPeriodWindow('month', NOW);
    expect(new Date(period.startAt).getDate()).toBe(1);
    expect(new Date(period.endAt).getMonth()).toBe(NOW.getMonth());
    expect(period.bucketGranularity).toBe('day');
  });
});

describe('driver statistics filtering and earnings', () => {
  test('includes completed rides for the current driver inside the selected period', () => {
    const vm = viewModel({
      rideHistory: [
        ride({ id: 'ride-1', agreedFare: 1_200, completedAt: new Date(2026, 6, 8, 9).toISOString() }),
        ride({ id: 'ride-2', agreedFare: 800, completedAt: new Date(2026, 6, 8, 11).toISOString() }),
      ],
    });

    expect(vm.metrics.completedTrips.value).toBe(2);
    expect(vm.metrics.periodEarningsRwf.value).toBe(2_000);
    expect(vm.metrics.earningsPerTripRwf.value).toBe(1_000);
  });

  test('excludes other drivers, cancelled rides, incomplete rides, and rides outside period', () => {
    const vm = viewModel({
      rideHistory: [
        ride({ id: 'included', agreedFare: 1_000, completedAt: new Date(2026, 6, 8, 9).toISOString() }),
        ride({ id: 'other-driver', driverId: 'driver-2', agreedFare: 3_000 }),
        ride({ id: 'cancelled', status: 'cancelled', agreedFare: 3_000 }),
        ride({ id: 'incomplete', completedAt: undefined, agreedFare: 3_000 }),
        ride({ id: 'yesterday', completedAt: new Date(2026, 6, 7, 9).toISOString(), agreedFare: 3_000 }),
      ],
    });

    expect(vm.metrics.completedTrips.value).toBe(1);
    expect(vm.metrics.periodEarningsRwf.value).toBe(1_000);
  });

  test('handles missing agreed fare and unavailable earnings per trip safely', () => {
    const noTrips = viewModel();
    const missingFare = viewModel({ rideHistory: [ride({ agreedFare: undefined })] });

    expect(noTrips.metrics.earningsPerTripRwf.value).toBeNull();
    expect(noTrips.metrics.earningsPerTripRwf.source.source).toBe('unavailable');
    expect(missingFare.metrics.periodEarningsRwf.value).toBe(0);
    expect(missingFare.metrics.earningsPerTripRwf.value).toBe(0);
  });
});

describe('driver statistics buckets', () => {
  test('creates 24 hourly today buckets with zero-filled empty buckets', () => {
    const vm = viewModel({
      rideHistory: [ride({ agreedFare: 1_500, completedAt: new Date(2026, 6, 8, 9, 15).toISOString() })],
    });

    expect(vm.buckets).toHaveLength(24);
    expect(vm.buckets[9].completedTrips).toBe(1);
    expect(vm.buckets[9].earningsRwf).toBe(1_500);
    expect(vm.buckets[8].completedTrips).toBe(0);
  });

  test('creates 7 daily week buckets', () => {
    const vm = viewModel({
      period: 'week',
      rideHistory: [ride({ agreedFare: 2_000, completedAt: new Date(2026, 6, 6, 12).toISOString() })],
    });

    expect(vm.buckets).toHaveLength(7);
    expect(vm.metrics.completedTrips.value).toBe(1);
    expect(vm.metrics.periodEarningsRwf.value).toBe(2_000);
  });

  test('creates daily current-month buckets', () => {
    const vm = viewModel({ period: 'month' });

    expect(vm.buckets).toHaveLength(31);
    expect(vm.buckets.every(bucket => bucket.completedTrips === 0 && bucket.earningsRwf === 0)).toBe(true);
  });
});

describe('driver statistics presentation series', () => {
  test('creates completed-trip series directly from buckets', () => {
    const vm = viewModel({
      rideHistory: [ride({ agreedFare: 1_500, completedAt: new Date(2026, 6, 8, 9, 15).toISOString() })],
    });

    const series = getCompletedTripsSeries(vm.buckets);

    expect(series).toHaveLength(24);
    expect(series[9]).toMatchObject({ value: 1, available: true });
    expect(series[8]).toMatchObject({ value: 0, available: true });
  });

  test('creates earnings-per-trip series without dividing zero-trip buckets', () => {
    const vm = viewModel({
      rideHistory: [
        ride({ agreedFare: 1_500, completedAt: new Date(2026, 6, 8, 9, 15).toISOString() }),
        ride({ agreedFare: 500, completedAt: new Date(2026, 6, 8, 9, 30).toISOString() }),
      ],
    });

    const series = getEarningsPerTripSeries(vm.buckets);

    expect(series[9]).toMatchObject({ value: 1_000, available: true });
    expect(series[8]).toMatchObject({ value: 0, available: false });
    expect(Number.isNaN(series[8].value)).toBe(false);
  });

  test('creates deterministic sparse labels for today, week, and month', () => {
    const today = viewModel({ period: 'today' });
    const week = viewModel({ period: 'week' });
    const month = viewModel({ period: 'month' });

    expect(getDriverStatisticsSparseLabels(today.period, today.buckets)).toEqual([
      { index: 0, label: '00' },
      { index: 6, label: '06' },
      { index: 12, label: '12' },
      { index: 18, label: '18' },
    ]);
    expect(getDriverStatisticsSparseLabels(week.period, week.buckets).map(item => item.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(getDriverStatisticsSparseLabels(month.period, month.buckets).map(item => item.label)).toEqual(['1', '16', '31']);
  });
});

describe('driver statistics insights', () => {
  test('returns no-trips insight when period has no completed trips', () => {
    const vm = viewModel();

    expect(vm.insights.map(item => item.id)).toContain('no-completed-trips');
  });

  test('returns completed trips, earnings per trip, and best earning bucket insights', () => {
    const vm = viewModel({
      rideHistory: [
        ride({ agreedFare: 1_000, completedAt: new Date(2026, 6, 8, 9).toISOString() }),
        ride({ agreedFare: 2_000, completedAt: new Date(2026, 6, 8, 11).toISOString() }),
      ],
    });

    expect(vm.insights.map(item => item.id)).toEqual([
      'completed-trips',
      'earnings-per-trip',
      'best-earning-bucket',
    ]);
  });
});

describe('driver statistics source metadata and new driver state', () => {
  test('marks metric sources and confidence', () => {
    const vm = viewModel();

    expect(vm.metrics.periodEarningsRwf.source.source).toBe('local_ride_history');
    expect(vm.metrics.periodEarningsRwf.source.confidence).toBe('medium');
    expect(vm.metrics.allTimeRideRevenueRwf.source.source).toBe('local_profile');
    expect(vm.metrics.acceptanceRate.source.confidence).toBe('low');
    expect(vm.metrics.driverRating.source.source).toBe('local_ratings');
    expect(vm.metrics.rideBalance.source.source).toBe('local_entitlement');
  });

  test('exposes entitlement and package history as supporting data', () => {
    const vm = viewModel({
      driverEntitlement: entitlement({
        purchaseHistory: [{
          amount: 2_000,
          createdAt: NOW.toISOString(),
          packageId: 'growth',
          phoneNumber: '+250788000000',
          provider: 'mtn',
          status: 'successful',
          transactionId: 'txn-1',
          vehicleId: 'vehicle-1',
          vehicleType: 'moto',
        }],
      }),
    });

    expect(vm.metrics.rideBalance.value).toEqual({
      remainingBonusRides: 3,
      remainingRideCredits: 8,
      totalAvailableRides: 11,
    });
    expect(vm.metrics.packagePurchaseHistory.value).toHaveLength(1);
    expect(vm.metrics.packagePurchaseHistory.source.note).toContain('Supporting');
  });

  test('new-driver state is true only when there is no meaningful data', () => {
    const newDriver = createDriverStatisticsViewModel({
      currentDriverId: 'driver-1',
      driverEntitlement: entitlement({ purchaseHistory: [] }),
      driverProfile: { ...profile, completedRides: 0, earningsTotal: 0, dailyDeclines: 0, dailyRides: 0 },
      driverRatingSummary: { averageRating: null, ratingCount: 0 },
      now: NOW,
      rideHistory: [],
      selectedPeriod: 'today',
    });
    const activeDriver = viewModel({
      driverProfile: { ...profile, completedRides: 1 },
      rideHistory: [ride({})],
    });

    expect(newDriver.isNewDriverStatsState).toBe(true);
    expect(newDriver.emptyStateTitle).toBe('Start driving to build your statistics.');
    expect(activeDriver.isNewDriverStatsState).toBe(false);
  });
});
