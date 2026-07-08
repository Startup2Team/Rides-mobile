import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import {
  CUSTOMER_HOME_ROUTE,
  getRideFlowNavigationDecision,
  isCustomerHomePath,
} from './rideFlowNavigation';
import { replaceFlowScreen } from './navigationPolicy';

export function useRideFlowNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { currentRide, isMatchingPaused } = useRide();
  const previousPathnameRef = useRef(pathname);
  const suppressHomeRedirectRef = useRef(false);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    if (previousPathname === '/rating' && isCustomerHomePath(pathname)) {
      suppressHomeRedirectRef.current = true;
    }
    if (!currentRide) {
      suppressHomeRedirectRef.current = false;
    }
    previousPathnameRef.current = pathname;

    if (user?.mode === 'driver') return;

    const decision = getRideFlowNavigationDecision({
      pathname,
      status: currentRide?.status ?? null,
      isMatchingPaused,
      suppressHomeRedirect: suppressHomeRedirectRef.current,
    });
    if (!decision) return;

    if (decision.method === 'backOrHome') {
      if (router.canGoBack()) {
        router.back();
      } else {
        replaceFlowScreen(router, CUSTOMER_HOME_ROUTE);
      }
      return;
    }

    router[decision.method](decision.href);
  }, [currentRide, currentRide?.status, isMatchingPaused, pathname, user?.mode]);
}
