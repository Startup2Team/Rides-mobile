import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import {
  packageCampaignRepository,
  packageCatalogRepository,
  type PackageCampaignRepository,
  type PackageCatalogRepository,
} from '@/services/packageSyncRepositories';

interface PackageSyncContextValue {
  catalog: DriverRidePackageCatalogEntry[];
  campaigns: DriverRidePackageCampaign[];
  hasCatalogSnapshot: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  syncWarning: string | null;
  lastSyncedAt: string | null;
  refresh: () => Promise<void>;
}

const PackageSyncContext = createContext<PackageSyncContextValue | null>(null);

function latestSyncTime(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

export function PackageSyncProvider({
  children,
  catalogRepository = packageCatalogRepository,
  campaignRepository = packageCampaignRepository,
}: {
  children: React.ReactNode;
  catalogRepository?: PackageCatalogRepository;
  campaignRepository?: PackageCampaignRepository;
}) {
  const [catalog, setCatalog] = useState<DriverRidePackageCatalogEntry[]>([]);
  const [campaigns, setCampaigns] = useState<DriverRidePackageCampaign[]>([]);
  const [hasCatalogSnapshot, setHasCatalogSnapshot] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const operation = (async () => {
      if (mountedRef.current) setIsRefreshing(true);
      const [catalogResult, campaignResult] = await Promise.allSettled([
        catalogRepository.refreshCatalog(),
        campaignRepository.refreshCampaigns(),
      ]);
      if (!mountedRef.current) return;

      if (catalogResult.status === 'fulfilled') {
        setCatalog(catalogResult.value);
        setHasCatalogSnapshot(true);
      }
      if (campaignResult.status === 'fulfilled') setCampaigns(campaignResult.value);

      const failed = catalogResult.status === 'rejected' || campaignResult.status === 'rejected';
      setSyncWarning(failed ? 'Using cached package data' : null);
      const [catalogSyncTime, campaignSyncTime] = await Promise.all([
        catalogRepository.getLastSyncTime(),
        campaignRepository.getLastSyncTime(),
      ]);
      if (mountedRef.current) setLastSyncedAt(latestSyncTime(catalogSyncTime, campaignSyncTime));
    })().finally(() => {
      refreshPromiseRef.current = null;
      if (mountedRef.current) setIsRefreshing(false);
    });
    refreshPromiseRef.current = operation;
    return operation;
  }, [campaignRepository, catalogRepository]);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const [cachedCatalog, cachedCampaigns, catalogSyncTime, campaignSyncTime] = await Promise.all([
        catalogRepository.getCatalog(),
        campaignRepository.getCampaigns(),
        catalogRepository.getLastSyncTime(),
        campaignRepository.getLastSyncTime(),
      ]);
      if (!mountedRef.current) return;
      if (cachedCatalog) {
        setCatalog(cachedCatalog);
        setHasCatalogSnapshot(true);
      }
      if (cachedCampaigns) setCampaigns(cachedCampaigns);
      setLastSyncedAt(latestSyncTime(catalogSyncTime, campaignSyncTime));
      const hasCachedCatalog = cachedCatalog !== null;
      if (hasCachedCatalog) setIsLoading(false);
      await refresh();
      if (mountedRef.current) setIsLoading(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [campaignRepository, catalogRepository, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasInactive = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasInactive && nextState === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo(() => ({
    catalog,
    campaigns,
    hasCatalogSnapshot,
    isLoading,
    isRefreshing,
    syncWarning,
    lastSyncedAt,
    refresh,
  }), [campaigns, catalog, hasCatalogSnapshot, isLoading, isRefreshing, lastSyncedAt, refresh, syncWarning]);

  return <PackageSyncContext.Provider value={value}>{children}</PackageSyncContext.Provider>;
}

export function usePackageSync() {
  const context = useContext(PackageSyncContext);
  if (!context) throw new Error('usePackageSync must be used within PackageSyncProvider');
  return context;
}
