import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import { usePackageCampaignsQuery, usePackageCatalogQuery } from '@/domains/packages/hooks';
import { packageKeys } from '@/query/keys';
import {
  packageOfferSourceRepository,
  type PackageOfferSourceRepository,
} from '@/services/packageSyncRepositories';
import { openDriverSocket, type DriverSocketEvent } from '@/services/driverTrackingSocket';

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
const PACKAGE_VEHICLE_TYPES = ['moto', 'rifani', 'cab', 'fuso', 'hilux'] as const;

export function PackageSyncProvider({
  children,
  offerSourceRepository = packageOfferSourceRepository,
}: {
  children: React.ReactNode;
  offerSourceRepository?: PackageOfferSourceRepository;
}) {
  const queryClient = useQueryClient();
  const catalogQuery = usePackageCatalogQuery();
  const campaignsQuery = usePackageCampaignsQuery();
  const [syncGeneration, setSyncGeneration] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const offerSourceReadyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      const cached = await offerSourceRepository.getOfferSource();
      if (mountedRef.current && cached) {
        queryClient.setQueryData(packageKeys.catalog(), cached.catalog);
        queryClient.setQueryData(packageKeys.campaigns(), cached.campaigns);
        PACKAGE_VEHICLE_TYPES.forEach(vehicleType => {
          queryClient.setQueryData(
            packageKeys.catalog(vehicleType),
            cached.catalog.filter(entry => entry.vehicleType === vehicleType),
          );
        });
        setSyncGeneration(cached.generation);
        setLastSyncedAt(cached.lastSuccessfulGenerationAt);
        offerSourceReadyRef.current = cached.catalogLoaded && cached.campaignsLoaded;
      }
      void refresh();
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (options?: { isUserInitiated?: boolean }) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const isUserInitiated = options?.isUserInitiated === true;
    const operation = (async () => {
      if (mountedRef.current && isUserInitiated) setIsRefreshing(true);
      const startTime = Date.now();
      const result = await offerSourceRepository.refreshOfferSource()
        .then(value => ({ status: 'fulfilled' as const, value }))
        .catch(reason => ({ status: 'rejected' as const, reason }));

      if (isUserInitiated) {
        const elapsedTime = Date.now() - startTime;
        const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
        if (elapsedTime < minDuration) {
          await new Promise(resolve => setTimeout(resolve, minDuration - elapsedTime));
        }
      }

      if (!mountedRef.current) return;

      if (result.status === 'fulfilled') {
        offerSourceReadyRef.current = true;
        setSyncGeneration(result.value.generation);
        setLastSyncedAt(result.value.lastSuccessfulGenerationAt);
        setSyncWarning(null);
        queryClient.setQueryData(packageKeys.catalog(), result.value.catalog);
        queryClient.setQueryData(packageKeys.campaigns(), result.value.campaigns);
        PACKAGE_VEHICLE_TYPES.forEach(vehicleType => {
          queryClient.setQueryData(
            packageKeys.catalog(vehicleType),
            result.value.catalog.filter(entry => entry.vehicleType === vehicleType),
          );
        });
      } else {
        setSyncWarning(offerSourceReadyRef.current
          ? 'Using cached package data'
          : 'Packages unavailable. Please try again.');
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
      if (mountedRef.current && isUserInitiated) setIsRefreshing(false);
    });
    refreshPromiseRef.current = operation;
    return operation;
  }, [offerSourceRepository, queryClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // WhatsApp-style WebSocket event push listener for instant real-time package updates
  useEffect(() => {
    const socket = openDriverSocket({
      onEvent: (event: DriverSocketEvent) => {
        if (event.type === 'PACKAGE_CATALOG_UPDATED') {
          console.log('[REALTIME:WS] ⚡ WhatsApp-style package catalog event received! Re-syncing package state instantly...');
          void refresh();
        }
      },
    });
    return () => {
      socket.close();
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasInactive = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasInactive && nextState === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const catalog = catalogQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const hasCatalogSnapshot = Boolean(syncGeneration) || catalog.length > 0 || campaigns.length > 0;
  const catalogLoaded = Boolean(syncGeneration);
  const campaignsLoaded = Boolean(syncGeneration);
  const offerSourceReady = catalogLoaded && campaignsLoaded;
  const isLoading = catalogQuery.isLoading || campaignsQuery.isLoading;

  const value = useMemo(() => ({
    catalog,
    campaigns,
    hasCatalogSnapshot,
    catalogLoaded,
    campaignsLoaded,
    offerSourceReady,
    syncGeneration,
    lastSuccessfulGenerationAt: lastSyncedAt,
    isLoading,
    isRefreshing,
    syncWarning,
    lastSyncedAt,
    refresh,
  }), [campaigns, campaignsLoaded, catalog, catalogLoaded, hasCatalogSnapshot, isLoading, isRefreshing, lastSyncedAt, refresh, syncGeneration, syncWarning, offerSourceReady]);

  return <PackageSyncContext.Provider value={value}>{children}</PackageSyncContext.Provider>;
}

export function usePackageSync() {
  const context = useContext(PackageSyncContext);
  if (!context) throw new Error('usePackageSync must be used within PackageSyncProvider');
  return context;
}
