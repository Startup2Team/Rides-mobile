import { useMemo } from 'react';
import { useOptionalAuth } from '@/context/AuthContext';
import { useOptionalDriverEntitlement } from '@/context/DriverEntitlementContext';
import { getDriverVehicles } from '@/domain/driverVehicles';
import { resolveCapabilities } from './resolver';
import type { CapabilityName, CapabilitySet } from './types';

const defaultCapabilities: CapabilitySet = {
  canBookRide: false,
  canReceiveRideRequests: false,
  canGoOnline: false,
  canDrive: false,
  canEditProfile: false,
  canManageVehicles: false,
  canBuyPackages: false,
  canUseWallet: false,
  canWithdrawEarnings: false,
  canReceivePayments: false,
  canInviteDrivers: false,
  canOperateFleet: false,
  canUseCorporateBilling: false,
  canViewDriverDashboard: false,
  canViewCustomerTrips: false,
  canSwitchMode: false,
  canBecomeDriver: false,
};

export function useCapabilities() {
  const auth = useOptionalAuth();
  const entitlement = useOptionalDriverEntitlement();

  return useMemo(() => {
    if (!auth) {
      return defaultCapabilities;
    }
    return resolveCapabilities({
      user: auth.user,
      driverProfile: auth.driverProfile,
      driverEntitlement: entitlement?.entitlement ?? null,
      vehicles: getDriverVehicles(auth.driverProfile),
      mode: auth.user?.mode ?? null,
    }).capabilities;
  }, [auth, entitlement?.entitlement]);
}

export function useCapability(name: CapabilityName) {
  const capabilities = useCapabilities();
  return capabilities[name];
}
