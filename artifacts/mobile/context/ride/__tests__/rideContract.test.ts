import {
  isRideTransitionAllowed,
  RIDE_ALLOWED_TRANSITIONS,
  type RideLifecycleStatus,
} from '../rideContract';

describe('future ride command/event transition contract', () => {
  test('defines the canonical happy-path lifecycle', () => {
    const path: RideLifecycleStatus[] = [
      'searching',
      'driver_assigned',
      'negotiating',
      'confirmed',
      'arriving',
      'arrived',
      'in_progress',
      'completed',
    ];

    for (let index = 0; index < path.length - 1; index++) {
      expect(isRideTransitionAllowed(path[index], path[index + 1])).toBe(true);
    }
  });

  test('treats completed and cancelled rides as terminal', () => {
    expect(RIDE_ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(RIDE_ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  test('rejects skipped and reversed lifecycle transitions', () => {
    expect(isRideTransitionAllowed('searching', 'confirmed')).toBe(false);
    expect(isRideTransitionAllowed('arrived', 'confirmed')).toBe(false);
    expect(isRideTransitionAllowed('completed', 'in_progress')).toBe(false);
  });
});
