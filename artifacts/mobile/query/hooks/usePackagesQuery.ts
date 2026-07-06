import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { packageRepository, getDriverEntitlement, saveDriverEntitlement, getDriverPackagePurchases } from '@/domains/packages/repository';
import type {
  DriverEntitlement,
  DriverEntitlementVehicleRef,
  DriverPackageOfferSnapshot,
  DriverPackagePurchase,
  DriverPackagePurchaseStatus,
  DriverRidePackageCampaign,
  DriverRidePackageCatalogEntry,
  MobileMoneyPackageProvider,
  PackageActivation,
  VehicleType,
} from '@/domains/packages/types';
import { EMPTY_DRIVER_ENTITLEMENT, activatePackageOffer, createPackageOfferSnapshot, createPackagePurchaseFromOffer, deductCreditForCompletedRide, getEntitlementVehicleForProfile, updatePackagePurchaseStatus } from '@/domain/driverRidePackages';
import { getActivePackages } from '@/domain/driverRidePackageCatalog';
import { getActiveDriverRideCampaigns, resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { packageKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

interface PackageMutationContext {
  entitlementKey: ReturnType<typeof packageKeys.entitlements>;
  purchasesKey: ReturnType<typeof packageKeys.purchases>;
  offersKey: ReturnType<typeof packageKeys.offers>;
  previousEntitlement: DriverEntitlement | null;
  previousPurchases: DriverPackagePurchase[];
  previousOffers: DriverPackageOfferSnapshot[];
}

function resolveDriverId(driverId?: string | null, fallbackDriverId?: string | null) {
  return driverId ?? fallbackDriverId ?? 'current';
}

function resolveDriverIds(driverId?: string | null, fallbackDriverId?: string | null) {
  return [...new Set([
    resolveDriverId(driverId),
    resolveDriverId(fallbackDriverId),
  ])];
}

function resolveVehicleRef(
  driverProfile: ReturnType<typeof useAuth>['driverProfile'],
  entitlement: DriverEntitlement | null | undefined,
): DriverEntitlementVehicleRef | null {
  return getEntitlementVehicleForProfile(driverProfile)
    ?? (entitlement?.vehicleId && entitlement.vehicleType
      ? { vehicleId: entitlement.vehicleId, vehicleType: entitlement.vehicleType }
      : null);
}

function getPurchases(entitlement: DriverEntitlement | null | undefined) {
  return entitlement?.purchaseHistory ?? [];
}

function getDriverKeys(driverId?: string | null, vehicleType?: VehicleType | null, fallbackDriverId: string | null = null) {
  const resolvedDriverId = resolveDriverId(driverId, fallbackDriverId);
  return {
    entitlementKey: packageKeys.entitlements(resolvedDriverId),
    purchasesKey: packageKeys.purchases(resolvedDriverId),
    offersKey: packageKeys.offers(resolvedDriverId, vehicleType ?? undefined),
  };
}

function updateCacheEntitlement(
  queryClient: ReturnType<typeof useQueryClient>,
  driverIds: Array<string | null | undefined>,
  entitlement: DriverEntitlement | null,
) {
  resolveDriverIds(...driverIds).forEach(driverId => {
    queryClient.setQueryData(packageKeys.entitlements(driverId), entitlement);
    queryClient.setQueryData(packageKeys.purchases(driverId), getPurchases(entitlement));
  });
}

function getCachedEntitlement(
  queryClient: ReturnType<typeof useQueryClient>,
  driverIds: Array<string | null | undefined>,
) {
  for (const driverId of resolveDriverIds(...driverIds)) {
    const entitlement = queryClient.getQueryData<DriverEntitlement | null>(packageKeys.entitlements(driverId));
    if (entitlement) return entitlement;
  }
  return null;
}

function toDriverPackageOffers(
  catalog: DriverRidePackageCatalogEntry[],
  campaigns: DriverRidePackageCampaign[],
  entitlement: DriverEntitlement | null,
  vehicleType: VehicleType | null | undefined,
  ownerUserId: string | null,
) {
  const vehicle = entitlement?.vehicleId && entitlement?.vehicleType
    ? { vehicleId: entitlement.vehicleId, vehicleType: entitlement.vehicleType }
    : null;
  if (!vehicleType || !vehicle) return [] as DriverPackageOfferSnapshot[];
  const activeCampaigns = getActiveDriverRideCampaigns(campaigns);
  return getActivePackages(vehicleType, catalog).map(entry =>
    createPackageOfferSnapshot(
      resolvePackageOffer({
      package: entry,
      vehicleType,
      entitlement,
      activeCampaigns,
      }),
      vehicle,
      new Date(),
      undefined,
      { ownerUserId },
    ),
  );
}

export function usePackageCatalogQuery(vehicleType?: VehicleType | null) {
  const queryClient = useQueryClient();
  return usePolicyQuery(queryPolicies.packageCatalog, {
    queryKey: packageKeys.catalog(vehicleType ?? undefined),
    queryFn: async () => {
      const offerSource = await packageRepository.getOfferSource();
      const catalog = offerSource?.catalog ?? (await packageRepository.getCatalog()) ?? [];
      const resolved = vehicleType ? catalog.filter(entry => entry.vehicleType === vehicleType) : catalog;
      if (resolved.length > 0) return resolved;
      return queryClient.getQueryData<DriverRidePackageCatalogEntry[]>(packageKeys.catalog(vehicleType ?? undefined)) ?? [];
    },
  });
}

export function usePackageCampaignsQuery() {
  const queryClient = useQueryClient();
  return usePolicyQuery(queryPolicies.packageCampaigns, {
    queryKey: packageKeys.campaigns(),
    queryFn: async () => {
      const offerSource = await packageRepository.getOfferSource();
      const campaigns = offerSource?.campaigns ?? (await packageRepository.getCampaigns()) ?? [];
      if (campaigns.length > 0) return campaigns;
      return queryClient.getQueryData<DriverRidePackageCampaign[]>(packageKeys.campaigns()) ?? [];
    },
  });
}

export function useDriverEntitlementsQuery(driverId?: string | null) {
  return usePolicyQuery(queryPolicies.packageEntitlements, {
    queryKey: packageKeys.entitlements(resolveDriverId(driverId)),
    queryFn: async () => getDriverEntitlement(),
  });
}

export function useDriverPackagePurchasesQuery(driverId?: string | null) {
  return usePolicyQuery(queryPolicies.packagePurchases, {
    queryKey: packageKeys.purchases(resolveDriverId(driverId)),
    queryFn: async () => getDriverPackagePurchases(),
  });
}

export function useAvailablePackageOffersQuery(driverId?: string | null, vehicleType?: VehicleType | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return usePolicyQuery(queryPolicies.packageOffers, {
    queryKey: packageKeys.offers(resolveDriverId(driverId), vehicleType ?? undefined),
    enabled: vehicleType != null,
    queryFn: async () => {
      const [offerSource, entitlement] = await Promise.all([
        packageRepository.getOfferSource(),
        getDriverEntitlement(),
      ]);
      const catalog = offerSource?.catalog ?? (await packageRepository.getCatalog()) ?? queryClient.getQueryData<DriverRidePackageCatalogEntry[]>(packageKeys.catalog(vehicleType ?? undefined)) ?? [];
      const campaigns = offerSource?.campaigns ?? (await packageRepository.getCampaigns()) ?? queryClient.getQueryData<DriverRidePackageCampaign[]>(packageKeys.campaigns()) ?? [];
      return toDriverPackageOffers(catalog, campaigns, entitlement, vehicleType, user?.id ?? null);
    },
  });
}

export function usePackagesQuery(vehicleType?: VehicleType | null) {
  return usePolicyQuery(queryPolicies.packages, {
    queryKey: packageKeys.catalog(vehicleType ?? undefined),
    queryFn: async () => {
      const [catalog, campaigns, offerSource] = await Promise.all([
        packageRepository.getCatalog(),
        packageRepository.getCampaigns(),
        packageRepository.getOfferSource(),
      ]);
      return {
        catalog: (offerSource?.catalog ?? catalog ?? []).filter(entry => (vehicleType ? entry.vehicleType === vehicleType : true)),
        campaigns: offerSource?.campaigns ?? campaigns ?? [],
        offerSource,
      };
    },
  });
}

export function useCreatePackagePurchaseMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile } = useAuth();
  const driverIds = resolveDriverIds('current', user?.id ?? null);

  return useMutation({
    mutationFn: async (input: {
      offer: DriverPackageOfferSnapshot;
      provider: MobileMoneyPackageProvider;
      phoneNumber: string;
    }) => {
      const current = (await getDriverEntitlement()) ?? EMPTY_DRIVER_ENTITLEMENT;
      const vehicle = { vehicleId: input.offer.vehicleId, vehicleType: input.offer.vehicleType };
      const result = createPackagePurchaseFromOffer(current, input, undefined, vehicle);
      await saveDriverEntitlement(result.entitlement);
      return result.purchase;
    },
    onMutate: async input => {
      const keys = getDriverKeys('current', input.offer.vehicleType, user?.id ?? null);
      await queryClient.cancelQueries({ queryKey: keys.entitlementKey });
      await queryClient.cancelQueries({ queryKey: keys.purchasesKey });
      await queryClient.cancelQueries({ queryKey: keys.offersKey });
      const previousEntitlement = getCachedEntitlement(queryClient, driverIds);
      const previousPurchases = queryClient.getQueryData<DriverPackagePurchase[]>(keys.purchasesKey) ?? [];
      const previousOffers = queryClient.getQueryData<DriverPackageOfferSnapshot[]>(keys.offersKey) ?? [];
      const vehicle = { vehicleId: input.offer.vehicleId, vehicleType: input.offer.vehicleType };
      const next = createPackagePurchaseFromOffer(previousEntitlement ?? EMPTY_DRIVER_ENTITLEMENT, input, undefined, vehicle);
      updateCacheEntitlement(queryClient, driverIds, next.entitlement);
      queryClient.setQueryData(keys.offersKey, previousOffers);
      return { ...keys, previousEntitlement, previousPurchases, previousOffers } satisfies PackageMutationContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      updateCacheEntitlement(queryClient, driverIds, context.previousEntitlement);
      queryClient.setQueryData(context.purchasesKey, context.previousPurchases);
      queryClient.setQueryData(context.offersKey, context.previousOffers);
    },
    onSuccess: (_purchase, input) => {
      const keys = getDriverKeys('current', input.offer.vehicleType, user?.id ?? null);
      const entitlement = getCachedEntitlement(queryClient, driverIds);
      updateCacheEntitlement(queryClient, driverIds, entitlement);
      queryClient.setQueryData(keys.purchasesKey, getPurchases(entitlement));
      void queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
    onSettled: async (_data, _error, input) => {
      const keys = getDriverKeys('current', input.offer.vehicleType, user?.id ?? null);
      await Promise.all(driverIds.map(async id => {
        await queryClient.invalidateQueries({ queryKey: packageKeys.entitlements(id) });
        await queryClient.invalidateQueries({ queryKey: packageKeys.purchases(id) });
      }));
      await queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
  });
}

export function useUpdatePackagePurchaseStatusMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile } = useAuth();
  const driverIds = resolveDriverIds('current', user?.id ?? null);

  return useMutation({
    mutationFn: async (input: {
      transactionId: string;
      status: Exclude<DriverPackagePurchaseStatus, 'idle'>;
    }) => {
      const current = (await getDriverEntitlement()) ?? EMPTY_DRIVER_ENTITLEMENT;
      const vehicle = resolveVehicleRef(driverProfile, current);
      const result = updatePackagePurchaseStatus(current, input.transactionId, input.status, undefined, vehicle);
      await saveDriverEntitlement(result.entitlement);
      return result;
    },
    onSuccess: result => {
      const vehicleType = result.purchase.vehicleType;
      const keys = getDriverKeys('current', vehicleType, user?.id ?? null);
      updateCacheEntitlement(queryClient, driverIds, result.entitlement);
      queryClient.setQueryData(keys.purchasesKey, getPurchases(result.entitlement));
      void queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
    onSettled: async (_data, _error, input) => {
      const entitlement = await getDriverEntitlement();
      const vehicleType = entitlement?.vehicleType ?? null;
      const keys = getDriverKeys('current', vehicleType, user?.id ?? null);
      await Promise.all(driverIds.map(async id => {
        await queryClient.invalidateQueries({ queryKey: packageKeys.entitlements(id) });
        await queryClient.invalidateQueries({ queryKey: packageKeys.purchases(id) });
      }));
      await queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
  });
}

export function useActivatePackageMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile } = useAuth();
  const driverIds = resolveDriverIds('current', user?.id ?? null);

  return useMutation({
    mutationFn: async (offer: DriverPackageOfferSnapshot) => {
      const current = (await getDriverEntitlement()) ?? EMPTY_DRIVER_ENTITLEMENT;
      const vehicle = resolveVehicleRef(driverProfile, current);
      const result = activatePackageOffer(current, offer, undefined, vehicle);
      await saveDriverEntitlement(result.entitlement);
      return result.activation;
    },
    onSuccess: activation => {
      const keys = getDriverKeys('current', activation.vehicleType, user?.id ?? null);
      void Promise.all(driverIds.map(async id => {
        await queryClient.invalidateQueries({ queryKey: packageKeys.entitlements(id) });
        await queryClient.invalidateQueries({ queryKey: packageKeys.purchases(id) });
      }));
      void queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
    onSettled: async (_data, _error, offer) => {
      const keys = getDriverKeys('current', offer.vehicleType, user?.id ?? null);
      await Promise.all(driverIds.map(async id => {
        await queryClient.invalidateQueries({ queryKey: packageKeys.entitlements(id) });
        await queryClient.invalidateQueries({ queryKey: packageKeys.purchases(id) });
      }));
      await queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
  });
}

export function useDeductRideCreditMutation() {
  const queryClient = useQueryClient();
  const { user, driverProfile } = useAuth();
  const driverIds = resolveDriverIds('current', user?.id ?? null);

  return useMutation({
    mutationFn: async (rideId: string) => {
      const current = (await getDriverEntitlement()) ?? EMPTY_DRIVER_ENTITLEMENT;
      const vehicle = resolveVehicleRef(driverProfile, current);
      const result = deductCreditForCompletedRide(current, rideId, undefined, vehicle);
      if (result.deducted) {
        await saveDriverEntitlement(result.entitlement);
      }
      return result;
    },
    onSuccess: result => {
      const keys = getDriverKeys('current', result.entitlement.vehicleType, user?.id ?? null);
      updateCacheEntitlement(queryClient, driverIds, result.entitlement);
      void queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
    onSettled: async (_data, _error, _rideId) => {
      const entitlement = await getDriverEntitlement();
      const keys = getDriverKeys('current', entitlement?.vehicleType ?? null, user?.id ?? null);
      await Promise.all(driverIds.map(async id => {
        await queryClient.invalidateQueries({ queryKey: packageKeys.entitlements(id) });
        await queryClient.invalidateQueries({ queryKey: packageKeys.purchases(id) });
      }));
      await queryClient.invalidateQueries({ queryKey: keys.offersKey });
    },
  });
}
