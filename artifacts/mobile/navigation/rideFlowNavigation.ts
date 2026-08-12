import type { RideStatus } from '@/types';

export const CUSTOMER_HOME_ROUTE = '/(tabs)';

const ACTIVE_RIDE_STATUSES: RideStatus[] = ['confirmed', 'arriving', 'arrived', 'in_progress'];

export type RideFlowNavigationDecision =
  | { method: 'push' | 'replace'; href: '/searching' | '/negotiation' | '/ride' | '/rating' | '/(tabs)' }
  | { method: 'backOrHome' };

export interface RideFlowNavigationState {
  pathname: string;
  status: RideStatus | null;
  isMatchingPaused: boolean;
  suppressHomeRedirect: boolean;
}

export function isCustomerHomePath(pathname: string) {
  return pathname === '/' || pathname === CUSTOMER_HOME_ROUTE;
}

export function getRideFlowNavigationDecision({
  pathname,
  status,
  isMatchingPaused,
  suppressHomeRedirect,
}: RideFlowNavigationState): RideFlowNavigationDecision | null {
  if (pathname === '/rating') return null;

  if (isCustomerHomePath(pathname)) {
    if (suppressHomeRedirect) return null;
    if (status === 'searching') return { method: 'push', href: '/searching' };
    if (status === 'negotiating' && !isMatchingPaused) {
      return { method: 'push', href: '/negotiation' };
    }
    if (status && ACTIVE_RIDE_STATUSES.includes(status)) {
      return { method: 'replace', href: '/ride' };
    }
    if (status === 'completed') return { method: 'replace', href: '/rating' };
    return null;
  }

  if (pathname === '/searching') {
    if (status === 'negotiating' && !isMatchingPaused) {
      return { method: 'replace', href: '/negotiation' };
    }
    // A 409-rejoin (RIDE_ALREADY_ACTIVE) can land an already-confirmed or
    // in-progress ride while the customer is still on the searching screen —
    // route them straight to it rather than leaving the spinner up.
    if (status && ACTIVE_RIDE_STATUSES.includes(status)) {
      return { method: 'replace', href: '/ride' };
    }
    if (status === 'completed') return { method: 'replace', href: '/rating' };
    if (!status || status === 'cancelled') return { method: 'backOrHome' };
    return null;
  }

  if (pathname === '/negotiation') {
    if (!status || status === 'cancelled') {
      return { method: 'replace', href: CUSTOMER_HOME_ROUTE };
    }
    if (ACTIVE_RIDE_STATUSES.includes(status)) {
      return { method: 'replace', href: '/ride' };
    }
    if (status === 'searching') return { method: 'replace', href: '/searching' };
    return null;
  }

  if (pathname === '/ride') {
    if (!status || status === 'cancelled') {
      return { method: 'replace', href: CUSTOMER_HOME_ROUTE };
    }
    if (status === 'negotiating') return { method: 'replace', href: '/negotiation' };
    if (status === 'searching') return { method: 'replace', href: '/searching' };
    if (status === 'completed') return { method: 'replace', href: '/rating' };
  }

  return null;
}
