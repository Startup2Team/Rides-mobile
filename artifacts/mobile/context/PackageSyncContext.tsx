import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import {
  packageOfferSourceRepository,
  type PackageOfferSourceRepository,
} from '@/services/packageSyncRepositories';

interface PackageSyncContextValue {
  catalog: DriverRidePackageCatalogEntry[];
  campaigns: DriverRidePackageCampaign[];
  hasCatalogSnapshot: boolean;
  catalogLoaded: boolean;
  campaignsLoaded: boolean;
  offerSourceReady: boolean;
  syncGeneration: string | null;
  lastSuccessfulGenerationAt: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  syncWarning: string | null;
  lastSyncedAt: string | null;
  refresh: () => Promise<void>;
}

const PackageSyncContext = createContext<PackageSyncContextValue | null>(null);

export function PackageSyncProvider({
  children,
  offerSourceRepository = packageOfferSourceRepository,
}: {
  children: React.ReactNode;
  offerSourceRepository?: PackageOfferSourceRepository;
}) {
  const [catalog, setCatalog] = useState<DriverRidePackageCatalogEntry[]>([]);
  const [campaigns, setCampaigns] = useState<DriverRidePackageCampaign[]>([]);
  const [hasCatalogSnapshot, setHasCatalogSnapshot] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [syncGeneration, setSyncGeneration] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const offerSourceReadyRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const operation = (async () => {
      if (mountedRef.current) setIsRefreshing(true);
      const result = await offerSourceRepository.refreshOfferSource()
        .then(value => ({ status: 'fulfilled' as const, value }))
        .catch(reason => ({ status: 'rejected' as const, reason }));
      if (!mountedRef.current) return;

      if (result.status === 'fulfilled') {
        setCatalog(result.value.catalog);
        setCampaigns(result.value.campaigns);
        setHasCatalogSnapshot(true);
        setCatalogLoaded(true);
        setCampaignsLoaded(true);
        offerSourceReadyRef.current = true;
        setSyncGeneration(result.value.generation);
        setLastSyncedAt(result.value.lastSuccessfulGenerationAt);
        setSyncWarning(null);
      } else {
        setSyncWarning(offerSourceReadyRef.current
          ? 'Using cached package data'
          : 'Packages unavailable. Please try again.');
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
      if (mountedRef.current) setIsRefreshing(false);
    });
    refreshPromiseRef.current = operation;
    return operation;
  }, [offerSourceRepository]);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const cached = await offerSourceRepository.getOfferSource();
      if (!mountedRef.current) return;
      if (cached?.catalogLoaded && cached.campaignsLoaded) {
        setCatalog(cached.catalog);
        setCampaigns(cached.campaigns);
        setHasCatalogSnapshot(true);
        setCatalogLoaded(true);
        setCampaignsLoaded(true);
        offerSourceReadyRef.current = true;
        setSyncGeneration(cached.generation);
        setLastSyncedAt(cached.lastSuccessfulGenerationAt);
      }
      if (cached) setIsLoading(false);
      await refresh();
      if (mountedRef.current) setIsLoading(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [offerSourceRepository, refresh]);

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
    catalogLoaded,
    campaignsLoaded,
    offerSourceReady: catalogLoaded && campaignsLoaded,
    syncGeneration,
    lastSuccessfulGenerationAt: lastSyncedAt,
    isLoading,
    isRefreshing,
    syncWarning,
    lastSyncedAt,
    refresh,
  }), [campaigns, campaignsLoaded, catalog, catalogLoaded, hasCatalogSnapshot, isLoading, isRefreshing, lastSyncedAt, refresh, syncGeneration, syncWarning]);

  return <PackageSyncContext.Provider value={value}>{children}</PackageSyncContext.Provider>;
}

export function usePackageSync() {
  const context = useContext(PackageSyncContext);
  if (!context) throw new Error('usePackageSync must be used within PackageSyncProvider');
  return context;
}
