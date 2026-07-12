import type { Ride } from '@/types';
import {
  buildDriverDailyStatisticsIndex,
  createDriverStatisticsViewModel,
  getDriverDailyStatisticsForDate,
  resolveDailyGoalForDate,
  type DriverDailyGoalRecord,
} from '@/domains/driver-statistics';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    agreedFare: 1_000,
    completedAt: new Date(2026, 6, 8, 9, 0).toISOString(),
    createdAt: new Date(2026, 6, 8, 8, 30).toISOString(),
    customerId: 'customer-1',
    destination: { latitude: -1.95, longitude: 30.08 },
    distance: 4,
    driverId: 'driver-1',
    duration: 12,
    id: 'ride-1',
    negotiation: [],
    pickup: { latitude: -1.94, longitude: 30.06 },
    status: 'completed',
    suggestedFare: 900,
    vehicleType: 'moto',
    ...overrides,
  };
}

function goal(effectiveFromLocalDate: string, amountRwf: number): DriverDailyGoalRecord {
  return {
    effectiveFromLocalDate,
    amountRwf,
    createdAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
    updatedAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
  };
}

describe('driver daily statistics', () => {
  test('includes only completed rides owned by the selected driver', () => {
    const rides = [
      ride({ id: 'completed', agreedFare: 2_000 }),
      ride({ id: 'cancelled', status: 'cancelled', agreedFare: 8_000 }),
      ride({ id: 'searching', status: 'searching', agreedFare: 9_000 }),
      ride({ id: 'other-driver', driverId: 'driver-2', agreedFare: 7_000 }),
    ];

    const result = getDriverDailyStatisticsForDate({
      rides,
      driverId: 'driver-1',
      localDate: '2026-07-08',
    });

    expect(result.completedTrips).toBe(1);
    expect(result.earningsRwf).toBe(2_000);
  });

  test('assigns a ride to the local completion date rather than its creation date', () => {
    const crossMidnightRide = ride({
      createdAt: new Date(2026, 6, 7, 23, 55).toISOString(),
      completedAt: new Date(2026, 6, 8, 0, 5).toISOString(),
      agreedFare: 3_000,
    });

    const index = buildDriverDailyStatisticsIndex({
      rides: [crossMidnightRide],
      driverId: 'driver-1',
    });

    expect(index.get('2026-07-07')).toBeUndefined();
    expect(index.get('2026-07-08')?.earningsRwf).toBe(3_000);
    expect(index.get('2026-07-08')?.hourlyEarningsRwf[0]).toBe(3_000);
  });

  test('skips invalid completion timestamps safely', () => {
    const result = buildDriverDailyStatisticsIndex({
      rides: [ride({ completedAt: 'not-a-date' })],
      driverId: 'driver-1',
    });

    expect(result.size).toBe(0);
  });

  test('normalizes negative and non-finite fares without reducing totals', () => {
    const result = getDriverDailyStatisticsForDate({
      rides: [
        ride({ id: 'positive', agreedFare: 2_000 }),
        ride({ id: 'negative', agreedFare: -500 }),
        ride({ id: 'infinite', agreedFare: Number.POSITIVE_INFINITY }),
      ],
      driverId: 'driver-1',
      localDate: '2026-07-08',
    });

    expect(result.completedTrips).toBe(3);
    expect(result.earningsRwf).toBe(2_000);
    expect(result.earningsPerTripRwf).toBeCloseTo(2_000 / 3);
  });

  test('hourly totals exactly equal daily totals', () => {
    const result = getDriverDailyStatisticsForDate({
      rides: [
        ride({ id: 'morning', agreedFare: 1_500, completedAt: new Date(2026, 6, 8, 8, 10).toISOString() }),
        ride({ id: 'evening', agreedFare: 2_500, completedAt: new Date(2026, 6, 8, 18, 20).toISOString() }),
      ],
      driverId: 'driver-1',
      localDate: '2026-07-08',
    });

    expect(result.hourlyEarningsRwf).toHaveLength(24);
    expect(result.hourlyCompletedTrips).toHaveLength(24);
    expect(result.hourlyEarningsRwf.reduce((sum, value) => sum + value, 0)).toBe(result.earningsRwf);
    expect(result.hourlyCompletedTrips.reduce((sum, value) => sum + value, 0)).toBe(result.completedTrips);
  });

  test('aggregates multiple dates in one predictable index', () => {
    const index = buildDriverDailyStatisticsIndex({
      rides: [
        ride({ id: 'later', completedAt: new Date(2026, 6, 9, 9).toISOString() }),
        ride({ id: 'earlier', completedAt: new Date(2026, 6, 8, 9).toISOString() }),
      ],
      driverId: 'driver-1',
    });

    expect(Array.from(index.keys())).toEqual(['2026-07-08', '2026-07-09']);
    expect(index.get('2026-07-08')?.completedTrips).toBe(1);
    expect(index.get('2026-07-09')?.completedTrips).toBe(1);
  });

  test('matches the Summary view model for the same local day', () => {
    const rides = [
      ride({ id: 'included', agreedFare: 4_000 }),
      ride({ id: 'cancelled', status: 'cancelled', agreedFare: 20_000 }),
      ride({ id: 'other', driverId: 'driver-2', agreedFare: 30_000 }),
    ];
    const now = new Date(2026, 6, 8, 14, 30);
    const daily = getDriverDailyStatisticsForDate({ rides, driverId: 'driver-1', localDate: '2026-07-08' });
    const summary = createDriverStatisticsViewModel({
      currentDriverId: 'driver-1',
      driverEntitlement: EMPTY_DRIVER_ENTITLEMENT,
      driverProfile: null,
      driverRatingSummary: { averageRating: null, ratingCount: 0 },
      now,
      rideHistory: rides,
      selectedPeriod: 'today',
    });

    expect(summary.metrics.periodEarningsRwf.value).toBe(daily.earningsRwf);
    expect(summary.metrics.completedTrips.value).toBe(daily.completedTrips);
    expect(summary.metrics.earningsPerTripRwf.value).toBe(daily.earningsPerTripRwf);
  });

  test('uses effective-dated historical goals for daily progress ratios', () => {
    const records = [goal('2026-07-01', 20_000), goal('2026-07-10', 40_000)];
    const earningsRwf = 10_000;

    const pastGoal = resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-08' });
    const currentGoal = resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-10' });

    expect(earningsRwf / pastGoal).toBe(0.5);
    expect(earningsRwf / currentGoal).toBe(0.25);
  });
});
