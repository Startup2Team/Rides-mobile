import { calcDistance, calcFare } from '../rideFare';
import { markRideArrived, startRideJourney } from '../rideTracking';
import { createRide } from './rideTestFactory';

describe('ride tracking and fare transitions', () => {
  test('calculates the existing rounded vehicle fare', () => {
    expect(calcFare('moto', 2)).toBe(900);
    expect(calcFare('cab', 2)).toBe(2300);
  });

  test('returns zero distance for identical coordinates', () => {
    const coords = { latitude: -1.9441, longitude: 30.0619 };

    expect(calcDistance(coords, coords)).toBe(0);
  });

  test('marks a ride arrived and then allows the journey to start', () => {
    const arriving = createRide({ status: 'arriving' });

    const arrived = markRideArrived(arriving);
    const inProgress = startRideJourney(arrived);

    expect(arrived).toEqual(expect.objectContaining({
      status: 'arrived',
      arrivedAt: expect.any(String),
      waitStartedAt: expect.any(String),
    }));
    expect(inProgress?.status).toBe('in_progress');
  });

  test('does not start a journey before the ride has arrived', () => {
    const confirmed = createRide({ status: 'confirmed' });

    expect(startRideJourney(confirmed)).toBe(confirmed);
  });
});
