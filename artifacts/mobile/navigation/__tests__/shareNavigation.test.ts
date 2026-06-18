import { getShareRouteForMode } from '../shareNavigation';

describe('share navigation', () => {
  test('routes customer users to the customer share tab and drivers to the driver share tab', () => {
    expect(getShareRouteForMode('customer')).toBe('/(tabs)/share');
    expect(getShareRouteForMode('driver')).toBe('/(driver)/share');
    expect(getShareRouteForMode(null)).toBe('/(tabs)/share');
  });
});

