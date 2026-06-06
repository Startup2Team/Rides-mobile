import { getRideFlowNavigationDecision } from '../rideFlowNavigation';

const decide = (
  pathname: string,
  status: Parameters<typeof getRideFlowNavigationDecision>[0]['status'],
  overrides: Partial<Parameters<typeof getRideFlowNavigationDecision>[0]> = {},
) =>
  getRideFlowNavigationDecision({
    pathname,
    status,
    isMatchingPaused: false,
    suppressHomeRedirect: false,
    ...overrides,
  });

describe('customer ride-flow navigation', () => {
  test('routes home into searching, negotiation, and active ride screens', () => {
    expect(decide('/', 'searching')).toEqual({ method: 'push', href: '/searching' });
    expect(decide('/', 'negotiating')).toEqual({ method: 'push', href: '/negotiation' });
    expect(decide('/', 'arriving')).toEqual({ method: 'replace', href: '/ride' });
  });

  test('keeps paused matching on the searching screen', () => {
    expect(decide('/searching', 'negotiating', { isMatchingPaused: true })).toBeNull();
    expect(decide('/searching', 'negotiating')).toEqual({
      method: 'replace',
      href: '/negotiation',
    });
  });

  test('returns missing or cancelled searching and negotiation rides home', () => {
    expect(decide('/searching', null)).toEqual({ method: 'backOrHome' });
    expect(decide('/negotiation', 'cancelled')).toEqual({
      method: 'replace',
      href: '/(tabs)',
    });
  });

  test('routes negotiation and ride screens to the current ride phase', () => {
    expect(decide('/negotiation', 'searching')).toEqual({
      method: 'replace',
      href: '/searching',
    });
    expect(decide('/negotiation', 'confirmed')).toEqual({
      method: 'replace',
      href: '/ride',
    });
    expect(decide('/ride', 'negotiating')).toEqual({
      method: 'replace',
      href: '/negotiation',
    });
  });

  test('routes completed rides to rating', () => {
    expect(decide('/ride', 'completed')).toEqual({ method: 'replace', href: '/rating' });
  });

  test('suppresses home redirects while rating completion clears the ride', () => {
    expect(decide('/', 'searching', { suppressHomeRedirect: true })).toBeNull();
    expect(decide('/', 'in_progress', { suppressHomeRedirect: true })).toBeNull();
    expect(decide('/rating', 'in_progress')).toBeNull();
  });

  test('does not redirect unrelated customer or driver routes', () => {
    expect(decide('/(tabs)/profile', 'searching')).toBeNull();
    expect(decide('/driver-navigate', 'in_progress')).toBeNull();
  });
});
