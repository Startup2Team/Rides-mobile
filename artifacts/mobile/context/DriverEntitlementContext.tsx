import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  activatePackage as activatePackageDomain,
  createPackagePurchase as createPackagePurchaseDomain,
  deductCreditForCompletedRide as deductCreditDomain,
  EMPTY_DRIVER_ENTITLEMENT,
  getEntitlementVehicleForProfile,
  getActiveBonusRides,
  getActiveRideCredits,
  getRideBalance,
  hasUsedLaunchOffer,
  normalizeEntitlement,
  updatePackagePurchaseStatus as updatePackagePurchaseStatusDomain,
  type DriverEntitlement,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
  type DriverRidePackageId,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import { useOptionalAuth } from './AuthContext';

interface DriverEntitlementContextType {
  entitlement: DriverEntitlement;
  isLoading: boolean;
  rideCredits: number;
  bonusRides: number;
  totalAvailableRides: number;
  launchOfferUsed: boolean;
  activatePackage: (packageId: DriverRidePackageId) => Promise<PackageActivation>;
  createPackagePurchase: (input: {
    packageId: DriverRidePackageId;
    provider: MobileMoneyPackageProvider;
    phoneNumber: string;
  }) => Promise<DriverPackagePurchase>;
  updatePackagePurchaseStatus: (
    transactionId: string,
    status: Exclude<DriverPackagePurchaseStatus, 'idle'>,
  ) => Promise<{ purchase: DriverPackagePurchase; activation?: PackageActivation }>;
  deductCreditForCompletedRide: (rideId: string) => Promise<boolean>;
}

const DriverEntitlementContext = createContext<DriverEntitlementContextType | null>(null);

export function DriverEntitlementProvider({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth();
  const activeVehicle = getEntitlementVehicleForProfile(auth?.driverProfile);
  const [entitlement, setEntitlement] = useState(EMPTY_DRIVER_ENTITLEMENT);
  const [isLoading, setIsLoading] = useState(true);
  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;
  const activeVehicleRef = useRef(activeVehicle);
  activeVehicleRef.current = activeVehicle;

  useEffect(() => {
    let active = true;
    void loadStoredDriverEntitlement().then(stored => {
      if (!active) return;
      if (stored.data) setEntitlement(stored.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading || !activeVehicle) return;
    let active = true;
    const normalized = normalizeEntitlement(entitlementRef.current, activeVehicle);
    if (JSON.stringify(normalized) === JSON.stringify(entitlementRef.current)) return;
    entitlementRef.current = normalized;
    setEntitlement(normalized);
    void Promise.resolve().then(() => {
      if (active) return saveStoredDriverEntitlement(normalized);
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [activeVehicle?.id, activeVehicle?.vehicleType, isLoading]);

  const persist = useCallback(async (next: DriverEntitlement) => {
    const normalized = normalizeEntitlement(next, activeVehicleRef.current);
    entitlementRef.current = normalized;
    setEntitlement(normalized);
    await saveStoredDriverEntitlement(normalized);
  }, []);

  const activatePackage = useCallback(async (packageId: DriverRidePackageId) => {
    const result = activatePackageDomain(entitlementRef.current, packageId, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return result.activation;
  }, [persist]);

  const createPackagePurchase = useCallback(async (input: {
    packageId: DriverRidePackageId;
    provider: MobileMoneyPackageProvider;
    phoneNumber: string;
  }) => {
    const result = createPackagePurchaseDomain(entitlementRef.current, input, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return result.purchase;
  }, [persist]);

  const updatePackagePurchaseStatus = useCallback(async (
    transactionId: string,
    status: Exclude<DriverPackagePurchaseStatus, 'idle'>,
  ) => {
    const result = updatePackagePurchaseStatusDomain(entitlementRef.current, transactionId, status, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return { purchase: result.purchase, activation: result.activation };
  }, [persist]);

  const deductCreditForCompletedRide = useCallback(async (rideId: string) => {
    const result = deductCreditDomain(entitlementRef.current, rideId, undefined, activeVehicleRef.current);
    if (result.deducted) await persist(result.entitlement);
    return result.deducted;
  }, [persist]);

  const activeEntitlement = useMemo(
    () => normalizeEntitlement(entitlement, activeVehicle),
    [activeVehicle?.id, activeVehicle?.vehicleType, entitlement],
  );

  const value = useMemo(() => ({
    entitlement: activeEntitlement,
    isLoading,
    rideCredits: getRideBalance(activeEntitlement),
    bonusRides: getActiveBonusRides(activeEntitlement),
    totalAvailableRides: getActiveRideCredits(activeEntitlement),
    launchOfferUsed: hasUsedLaunchOffer(activeEntitlement),
    activatePackage,
    createPackagePurchase,
    updatePackagePurchaseStatus,
    deductCreditForCompletedRide,
  }), [activatePackage, activeEntitlement, createPackagePurchase, deductCreditForCompletedRide, isLoading, updatePackagePurchaseStatus]);

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
