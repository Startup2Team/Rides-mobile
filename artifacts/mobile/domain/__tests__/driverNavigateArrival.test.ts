import {
  ARRIVAL_UNLOCK_KM,
  formatArrivalDistance,
  getArrivalVerification,
} from '../driverNavigateArrival';

const pickup = { latitude: -1.9365, longitude: 30.1011 };

function pointNorthOfPickup(distanceKm: number) {
  return {
    latitude: pickup.latitude + distanceKm / 111.195,
    longitude: pickup.longitude,
  };
}

describe('driver arrival verification', () => {
  test('driver cannot arrive when outside the arrival threshold', () => {
    const verification = getArrivalVerification(
      pointNorthOfPickup(ARRIVAL_UNLOCK_KM + 0.2),
      pickup,
    );

    expect(verification.canMarkArrived).toBe(false);
  });

  test('driver can arrive when inside the arrival threshold', () => {
    const verification = getArrivalVerification(
      pointNorthOfPickup(ARRIVAL_UNLOCK_KM - 0.2),
      pickup,
    );

    expect(verification.canMarkArrived).toBe(true);
  });

  test('ARRIVAL_UNLOCK_KM is enforced as the unlock boundary', () => {
    const inside = getArrivalVerification(
      pointNorthOfPickup(ARRIVAL_UNLOCK_KM - 0.01),
      pickup,
    );
    const outside = getArrivalVerification(
      pointNorthOfPickup(ARRIVAL_UNLOCK_KM + 0.01),
      pickup,
    );

    expect(inside.canMarkArrived).toBe(true);
    expect(outside.canMarkArrived).toBe(false);
  });

  test('distance display formats pickup proximity clearly', () => {
    expect(formatArrivalDistance(0.035)).toBe('35 m away');
    expect(formatArrivalDistance(0.12)).toBe('120 m away');
    expect(formatArrivalDistance(0.8)).toBe('0.8 km away');
  });
});
