import { getDriverFlowNavigationDecision } from '../driverFlowNavigation';

const decide = (
  pathname: string,
  status: Parameters<typeof getDriverFlowNavigationDecision>[0]['status'],
) => getDriverFlowNavigationDecision({ pathname, status });

describe('driver ride-flow navigation', () => {
  test('routes the driver dashboard into negotiation and navigation', () => {
    expect(decide('/(driver)', 'negotiating')).toEqual({
      method: 'push',
      href: '/driver-negotiation',
    });
    expect(decide('/(driver)', 'confirmed')).toEqual({
      method: 'push',
      href: '/driver-navigate',
    });
    expect(decide('/', 'arriving')).toEqual({
      method: 'push',
      href: '/driver-navigate',
    });
  });

  test('routes negotiation forward or back to the driver dashboard', () => {
    expect(decide('/driver-negotiation', 'confirmed')).toEqual({
      method: 'replace',
      href: '/driver-navigate',
    });
    expect(decide('/driver-negotiation', null)).toEqual({
      method: 'replace',
      href: '/(driver)',
    });
    expect(decide('/driver-negotiation', 'cancelled')).toEqual({
      method: 'replace',
      href: '/(driver)',
    });
  });

  test('returns missing navigation rides to the driver dashboard', () => {
    expect(decide('/driver-navigate', null)).toEqual({
      method: 'replace',
      href: '/(driver)',
    });
  });

  test('routes resumed mid-trip rides back onto the navigate screen', () => {
    // Cold-start hydration from GET /driver/rides/active can land straight in
    // 'arrived' / 'in_progress'; the dashboard must hand off to navigation.
    expect(decide('/(driver)', 'arrived')).toEqual({
      method: 'push',
      href: '/driver-navigate',
    });
    expect(decide('/(driver)', 'in_progress')).toEqual({
      method: 'push',
      href: '/driver-navigate',
    });
    expect(decide('/driver-negotiation', 'in_progress')).toEqual({
      method: 'replace',
      href: '/driver-navigate',
    });
  });

  test('preserves existing screens for statuses without automatic redirects', () => {
    expect(decide('/driver-negotiation', 'negotiating')).toBeNull();
    expect(decide('/driver-navigate', 'cancelled')).toBeNull();
    expect(decide('/(tabs)', 'negotiating')).toBeNull();
  });
});
