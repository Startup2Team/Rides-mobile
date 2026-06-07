import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  activatePackage as activatePackageDomain,
  deductCreditForCompletedRide as deductCreditDomain,
  EMPTY_DRIVER_ENTITLEMENT,
  getActiveRideCredits,
  hasUsedLaunchOffer,
  type DriverEntitlement,
  type DriverRidePackageId,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';

interface DriverEntitlementContextType {
  entitlement: DriverEntitlement;
  isLoading: boolean;
  rideCredits: number;
  launchOfferUsed: boolean;
  activatePackage: (packageId: DriverRidePackageId) => Promise<PackageActivation>;
  deductCreditForCompletedRide: (rideId: string) => Promise<boolean>;
}

const DriverEntitlementContext = createContext<DriverEntitlementContextType | null>(null);

export function DriverEntitlementProvider({ children }: { children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState(EMPTY_DRIVER_ENTITLEMENT);
  const [isLoading, setIsLoading] = useState(true);
  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;

  useEffect(() => {
    void loadStoredDriverEntitlement().then(stored => {
      if (stored.data) setEntitlement(stored.data);
      setIsLoading(false);
    });
  }, []);

  const persist = useCallback(async (next: DriverEntitlement) => {
    entitlementRef.current = next;
    setEntitlement(next);
    await saveStoredDriverEntitlement(next);
  }, []);

  const activatePackage = useCallback(async (packageId: DriverRidePackageId) => {
    const result = activatePackageDomain(entitlementRef.current, packageId);
    await persist(result.entitlement);
    return result.activation;
  }, [persist]);

  const deductCreditForCompletedRide = useCallback(async (rideId: string) => {
    const result = deductCreditDomain(entitlementRef.current, rideId);
    if (result.deducted) await persist(result.entitlement);
    return result.deducted;
  }, [persist]);

  const value = useMemo(() => ({
    entitlement,
    isLoading,
    rideCredits: getActiveRideCredits(entitlement),
    launchOfferUsed: hasUsedLaunchOffer(entitlement),
    activatePackage,
    deductCreditForCompletedRide,
  }), [activatePackage, deductCreditForCompletedRide, entitlement, isLoading]);

  return <DriverEntitlementContext.Provider value={value}>{children}</DriverEntitlementContext.Provider>;
}

export function useDriverEntitlement() {
  const context = useContext(DriverEntitlementContext);
  if (!context) throw new Error('useDriverEntitlement must be used within DriverEntitlementProvider');
  return context;
}

export function useOptionalDriverEntitlement() {
  return useContext(DriverEntitlementContext);
}
