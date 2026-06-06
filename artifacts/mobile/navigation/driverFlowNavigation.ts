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
    if (status === 'confirmed' || status === 'arriving') {
      return { method: 'push', href: '/driver-navigate' };
    }
    return null;
  }

  if (pathname === '/driver-negotiation') {
    if (status === 'confirmed' || status === 'arriving') {
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

  return null;
}
