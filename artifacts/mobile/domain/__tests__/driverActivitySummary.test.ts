import type { DriverProfile, Ride } from '@/types';
import { EMPTY_DRIVER_ENTITLEMENT } from '../driverRidePackages';
import { getDriverActivitySummary } from '../driverActivitySummary';

const driverProfile = {
  completedRides: 10,
  dailyRides: 8,
  earningsTotal: 50_000,
} as DriverProfile;

function completedRide(overrides: Partial<Ride>): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 2,
    duration: 10,
    suggestedFare: 1000,
    agreedFare: 1000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:20:00.000Z',
    ...overrides,
  };
}

describe('getDriverActivitySummary driver ownership', () => {
  const now = new Date('2026-06-08T12:00:00.000Z');

  test('customer completed ride does not count as driver earnings', () => {
    const summary = getDriverActivitySummary({
      driverId: 'driver-1',
      driverProfile,
      entitlement: EMPTY_DRIVER_ENTITLEMENT,
      rideHistory: [
        completedRide({ id: 'customer-ride', customerId: 'driver-1', agreedFare: 3500 }),
      ],
      now,
    });

    expect(summary.todayEarningsRwf).toBe(0);
    expect(summary.completedRidesToday).toBe(0);
  });

  test('driver completed ride counts as driver earnings', () => {
    const summary = getDriverActivitySummary({
      driverId: 'driver-1',
      driverProfile,
      entitlement: EMPTY_DRIVER_ENTITLEMENT,
      rideHistory: [
        completedRide({ id: 'driver-ride', driverId: 'driver-1', agreedFare: 3500 }),
      ],
      now,
    });

    expect(summary.todayEarningsRwf).toBe(3500);
    expect(summary.completedRidesToday).toBe(1);
  });

  test('completed ride for another driver does not count', () => {
    const summary = getDriverActivitySummary({
      driverId: 'driver-1',
      driverProfile,
      entitlement: EMPTY_DRIVER_ENTITLEMENT,
      rideHistory: [
        completedRide({ id: 'other-driver-ride', driverId: 'driver-2', agreedFare: 3500 }),
      ],
      now,
    });

    expect(summary.todayEarningsRwf).toBe(0);
    expect(summary.completedRidesToday).toBe(0);
  });

  test('rides without driverId do not count as driver earnings', () => {
    const summary = getDriverActivitySummary({
      driverId: 'driver-1',
      driverProfile,
      entitlement: EMPTY_DRIVER_ENTITLEMENT,
      rideHistory: [
        completedRide({ id: 'legacy-unowned-ride', agreedFare: 3500 }),
      ],
      now,
    });

    expect(summary.todayEarningsRwf).toBe(0);
    expect(summary.completedRidesToday).toBe(0);
  });
});
