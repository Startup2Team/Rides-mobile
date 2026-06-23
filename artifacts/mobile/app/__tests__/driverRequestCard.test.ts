import {
  formatDistanceToPickup,
  formatRequestLocation,
  formatTripDistance,
  formatTripDuration,
} from '../driverRequestCard';

describe('driver request card formatting', () => {
  test('uses safe fallbacks for missing request data', () => {
    expect(formatRequestLocation(undefined, 'Pickup unavailable')).toBe('Pickup unavailable');
    expect(formatRequestLocation({ address: '   ' }, 'Destination unavailable')).toBe('Destination unavailable');
    expect(formatDistanceToPickup(null, { latitude: -1.9365, longitude: 30.1011 })).toBe('Distance unavailable');
    expect(formatTripDistance(undefined)).toBe('Distance unavailable');
    expect(formatTripDuration(undefined)).toBe('Time unavailable');
  });

  test('formats available request distance and time fields', () => {
    expect(formatRequestLocation({ address: 'Kimironko Market' }, 'Pickup unavailable')).toBe('Kimironko Market');
    expect(formatTripDistance(4.46)).toBe('4.46 km');
    expect(formatTripDuration(18)).toBe('~18 min');
  });
});
