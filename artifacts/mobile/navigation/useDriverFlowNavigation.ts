import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { getDriverFlowNavigationDecision } from './driverFlowNavigation';

export function useDriverFlowNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { currentRide } = useRide();
  const lastDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.mode !== 'driver') {
      lastDecisionRef.current = null;
      return;
    }

    const decision = getDriverFlowNavigationDecision({
      pathname,
      status: currentRide?.status ?? null,
    });
    if (!decision) {
      lastDecisionRef.current = null;
      return;
    }

    const decisionKey = `${pathname}:${currentRide?.status ?? 'none'}:${decision.method}:${decision.href}`;
    if (lastDecisionRef.current === decisionKey) return;
    lastDecisionRef.current = decisionKey;
    router[decision.method](decision.href);
  }, [currentRide?.status, pathname, user?.mode]);
}
