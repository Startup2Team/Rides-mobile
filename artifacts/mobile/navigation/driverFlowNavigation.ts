import type { RideStatus } from '@/types';

export const DRIVER_HOME_ROUTE = '/(driver)';

export type DriverFlowNavigationDecision = {
  method: 'push' | 'replace';
  href: '/driver-negotiation' | '/driver-navigate' | '/(driver)';
};

export function isDriverHomePath(pathname: string) {
  return pathname === '/' || pathname === DRIVER_HOME_ROUTE;
}

export function getDriverFlowNavigationDecision({
  pathname,
  status,
}: {
  pathname: string;
  status: RideStatus | null;
}): DriverFlowNavigationDecision | null {
  if (isDriverHomePath(pathname)) {
    if (status === 'negotiating') return { method: 'push', href: '/driver-negotiation' };
    // 'arrived' / 'in_progress' matter on cold start: an active ride resumed
    // from GET /driver/rides/active can hydrate straight into them, and the
    // driver must land back on the navigate screen, not the dashboard.
    if (status === 'confirmed' || status === 'arriving' || status === 'arrived' || status === 'in_progress') {
      return { method: 'push', href: '/driver-navigate' };
    }
    return null;
  }

  if (pathname === '/driver-negotiation') {
    if (status === 'confirmed' || status === 'arriving' || status === 'arrived' || status === 'in_progress') {
      return { method: 'replace', href: '/driver-navigate' };
    }
    if (!status || status === 'cancelled') {
      return { method: 'replace', href: DRIVER_HOME_ROUTE };
    }
    return null;
  }

  if (pathname === '/driver-navigate' && !status) {
    return { method: 'replace', href: DRIVER_HOME_ROUTE };
  }

  if (pathname === '/driver-ride-complete') {
    return null;
  }

  return null;
}
