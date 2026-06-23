import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  activatePackageOffer as activatePackageOfferDomain,
  createPackagePurchaseFromOffer as createPackagePurchaseDomain,
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
  type DriverPackageOfferSnapshot,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import { useOptionalAuth } from './AuthContext';
import { purchaseDriverPackage, getDriverCredits } from '@/services/driverRides';

interface DriverEntitlementContextType {
  entitlement: DriverEntitlement;
  isLoading: boolean;
  /** Authoritative ride credits — backend ledger total when available. */
  rideCredits: number;
  bonusRides: number;
  totalAvailableRides: number;
  launchOfferUsed: boolean;
  /** Re-fetch the credit balance from the backend ledger. */
  refreshCredits: () => Promise<void>;
  activatePackage: (offer: DriverPackageOfferSnapshot) => Promise<PackageActivation>;
  createPackagePurchase: (input: {
    offer: DriverPackageOfferSnapshot;
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
  // Backend ledger is the authority for the credit balance. The local
  // entitlement is still kept for the offer-lock / receipt UI, but the number we
  // display comes from the server (matches the ride accept-gate + deduction).
  const [serverCredits, setServerCredits] = useState<number | null>(null);
  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;
  const activeVehicleRef = useRef(activeVehicle);
  activeVehicleRef.current = activeVehicle;

  const refreshCredits = useCallback(async () => {
    try {
      setServerCredits(await getDriverCredits());
    } catch {
      // leave the previous value on a transient failure
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadStoredDriverEntitlement().then(stored => {
      if (!active) return;
      if (stored.data) setEntitlement(stored.data);
      setIsLoading(false);
    });
    void refreshCredits();
    return () => {
      active = false;
    };
  }, [refreshCredits]);

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

  const activatePackage = useCallback(async (offer: DriverPackageOfferSnapshot) => {
    // Free/promotional package: the backend grants it immediately (offer.packageId
    // is the backend package uuid). Then the local domain records the activation
    // for the receipt UI; the displayed balance comes from the backend.
    await purchaseDriverPackage(offer.packageId);
    void refreshCredits();
    const result = activatePackageOfferDomain(entitlementRef.current, offer, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return result.activation;
  }, [persist, refreshCredits]);

  const createPackagePurchase = useCallback(async (input: {
    offer: DriverPackageOfferSnapshot;
    provider: MobileMoneyPackageProvider;
    phoneNumber: string;
  }) => {
    // Charge the package on the backend (MoMo; dev auto-confirms). The ledger
    // grant happens server-side on confirmation. A failure here propagates so the
    // payment screen shows it.
    await purchaseDriverPackage(input.offer.packageId, {
      momoPhone: input.phoneNumber,
      momoProvider: input.provider,
    });
    void refreshCredits();
    // Local purchase record drives the screen's receipt / status flow.
    const result = createPackagePurchaseDomain(entitlementRef.current, input, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return result.purchase;
  }, [persist, refreshCredits]);

  const updatePackagePurchaseStatus = useCallback(async (
    transactionId: string,
    status: Exclude<DriverPackagePurchaseStatus, 'idle'>,
  ) => {
    const result = updatePackagePurchaseStatusDomain(entitlementRef.current, transactionId, status, undefined, activeVehicleRef.current);
    await persist(result.entitlement);
    return { purchase: result.purchase, activation: result.activation };
  }, [persist]);

  const deductCreditForCompletedRide = useCallback(async (rideId: string) => {
    // The backend already deducts one credit at fare AGREEMENT (CONFIRMED) via
    // the ledger — never at completion. So we never deduct on the backend here;
    // we just re-sync the authoritative balance. The local domain deduction is
    // kept so the local entitlement history stays coherent.
    void refreshCredits();
    const result = deductCreditDomain(entitlementRef.current, rideId, undefined, activeVehicleRef.current);
    if (result.deducted) await persist(result.entitlement);
    return result.deducted;
  }, [persist, refreshCredits]);

  const activeEntitlement = useMemo(
    () => normalizeEntitlement(entitlement, activeVehicle),
    [activeVehicle?.id, activeVehicle?.vehicleType, entitlement],
  );

  const value = useMemo(() => ({
    entitlement: activeEntitlement,
    isLoading,
    // Backend ledger total is authoritative; fall back to the local balance only
    // before the first fetch resolves.
    rideCredits: serverCredits ?? getRideBalance(activeEntitlement),
    bonusRides: getActiveBonusRides(activeEntitlement),
    totalAvailableRides: serverCredits ?? getActiveRideCredits(activeEntitlement),
    launchOfferUsed: hasUsedLaunchOffer(activeEntitlement),
    refreshCredits,
    activatePackage,
    createPackagePurchase,
    updatePackagePurchaseStatus,
    deductCreditForCompletedRide,
  }), [activatePackage, activeEntitlement, createPackagePurchase, deductCreditForCompletedRide, isLoading, refreshCredits, serverCredits, updatePackagePurchaseStatus]);

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
