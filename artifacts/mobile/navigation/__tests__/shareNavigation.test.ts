import { getShareRouteForMode } from '../shareNavigation';

describe('share navigation', () => {
  test('routes both customer and driver users to the root share route', () => {
    expect(getShareRouteForMode('customer')).toBe('/share');
    expect(getShareRouteForMode('driver')).toBe('/share');
    expect(getShareRouteForMode(null)).toBe('/share');
  });
});
