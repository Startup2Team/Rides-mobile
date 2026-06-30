import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  EMPTY_DRIVER_ENTITLEMENT,
  getActiveBonusRides,
  getActiveRideCredits,
  getEntitlementVehicleForProfile,
  getRideBalance,
  hasUsedLaunchOffer,
  normalizeEntitlement,
  type DriverEntitlement,
  type DriverPackageOfferSnapshot,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { packageKeys } from '@/query/keys';
import {
  useActivatePackageMutation,
  useCreatePackagePurchaseMutation,
  useDeductRideCreditMutation,
  useDriverEntitlementsQuery,
  useUpdatePackagePurchaseStatusMutation,
} from '@/domains/packages/hooks';
import {
  getDriverEntitlement,
  saveDriverEntitlement,
} from '@/domains/packages/repository';
import { getStoredDriverEntitlementSnapshot } from '@/persistence/driverEntitlementPersistence';
import { useOptionalAuth } from './AuthContext';

interface DriverEntitlementContextType {
  entitlement: DriverEntitlement;
  isLoading: boolean;
  rideCredits: number;
  bonusRides: number;
  totalAvailableRides: number;
  launchOfferUsed: boolean;
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
  const queryClient = useQueryClient();
  const driverId = auth?.user?.id ?? 'current';
  const activeVehicle = getEntitlementVehicleForProfile(auth?.driverProfile);
  const entitlementQuery = useDriverEntitlementsQuery(driverId);
  const activatePackageMutation = useActivatePackageMutation();
  const createPackagePurchaseMutation = useCreatePackagePurchaseMutation();
  const updatePackagePurchaseStatusMutation = useUpdatePackagePurchaseStatusMutation();
  const deductCreditMutation = useDeductRideCreditMutation();
  const cachedEntitlement = getStoredDriverEntitlementSnapshot();
  const [entitlementSnapshot, setEntitlementSnapshot] = useState<DriverEntitlement>(() =>
    normalizeEntitlement(
      cachedEntitlement
        ?? entitlementQuery.data
        ?? EMPTY_DRIVER_ENTITLEMENT,
      activeVehicle,
    ),
  );

  const syncEntitlementSnapshot = useCallback(async () => {
    const latest = await getDriverEntitlement();
    const normalized = normalizeEntitlement(latest ?? EMPTY_DRIVER_ENTITLEMENT, activeVehicle);
    setEntitlementSnapshot(normalized);
    queryClient.setQueryData(packageKeys.entitlements(driverId), normalized);
    queryClient.setQueryData(packageKeys.purchases(driverId), normalized.purchaseHistory ?? []);
    return normalized;
  }, [activeVehicle, driverId, queryClient]);

  useEffect(() => {
    if (entitlementQuery.data) {
      setEntitlementSnapshot(normalizeEntitlement(entitlementQuery.data, activeVehicle));
      return;
    }
    if (!entitlementQuery.isLoading) {
      setEntitlementSnapshot(normalizeEntitlement(EMPTY_DRIVER_ENTITLEMENT, activeVehicle));
    }
  }, [activeVehicle, entitlementQuery.data, entitlementQuery.isLoading]);

  const entitlement = useMemo(
    () => normalizeEntitlement(entitlementSnapshot ?? EMPTY_DRIVER_ENTITLEMENT, activeVehicle),
    [activeVehicle, entitlementSnapshot],
  );

  useEffect(() => {
    if (!entitlementQuery.data) return;
    const normalized = normalizeEntitlement(entitlementQuery.data, activeVehicle);
    if (JSON.stringify(normalized) === JSON.stringify(entitlementQuery.data)) return;
    void saveDriverEntitlement(normalized)
      .then(() => {
        queryClient.setQueryData(packageKeys.entitlements(driverId), normalized);
        queryClient.setQueryData(packageKeys.purchases(driverId), normalized.purchaseHistory ?? []);
      })
      .catch(() => undefined);
  }, [activeVehicle, entitlementQuery.data, queryClient, driverId]);

  const value = useMemo(() => ({
    entitlement,
    isLoading: entitlementQuery.isLoading && cachedEntitlement == null,
    rideCredits: getRideBalance(entitlement),
    bonusRides: getActiveBonusRides(entitlement),
    totalAvailableRides: getActiveRideCredits(entitlement),
    launchOfferUsed: hasUsedLaunchOffer(entitlement),
    activatePackage: async (offer: DriverPackageOfferSnapshot) => {
      const activation = await activatePackageMutation.mutateAsync(offer);
      await syncEntitlementSnapshot();
      return activation;
    },
    createPackagePurchase: async (input: {
      offer: DriverPackageOfferSnapshot;
      provider: MobileMoneyPackageProvider;
      phoneNumber: string;
    }) => {
      const purchase = await createPackagePurchaseMutation.mutateAsync(input);
      await syncEntitlementSnapshot();
      return purchase;
    },
    updatePackagePurchaseStatus: async (
      transactionId: string,
      status: Exclude<DriverPackagePurchaseStatus, 'idle'>,
    ) => {
      const result = await updatePackagePurchaseStatusMutation.mutateAsync({ transactionId, status });
      await syncEntitlementSnapshot();
      return result;
    },
    deductCreditForCompletedRide: async (rideId: string) => {
      const result = await deductCreditMutation.mutateAsync(rideId);
      await syncEntitlementSnapshot();
      return result.deducted;
    },
  }), [
    activatePackageMutation,
    createPackagePurchaseMutation,
    deductCreditMutation,
    entitlement,
    cachedEntitlement,
    entitlementQuery.isLoading,
    syncEntitlementSnapshot,
    updatePackagePurchaseStatusMutation,
  ]);

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
