import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';
import { PackageSyncProvider, usePackageSync } from '../PackageSyncContext';
import type {
  PackageOfferSourceRepository,
} from '@/services/packageSyncRepositories';

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const cachedCatalog = [{
  packageId: 'cached_package',
  packageVersion: 'v1',
  packageName: 'Cached Package',
  vehicleType: 'moto' as const,
  priceRwf: 1_000,
  ridesGranted: 20,
  bonusRidesGranted: 5,
  status: 'active' as const,
  createdAt: '2026-06-19T00:00:00.000Z',
  effectiveFrom: '2026-06-19T00:00:00.000Z',
  effectiveUntil: null,
}];

function repository(options: { failRefresh?: boolean; emptyCache?: boolean } = {}) {
  const generation = {
    catalog: cachedCatalog,
    campaigns: [],
    catalogLoaded: true as const,
    campaignsLoaded: true as const,
    generation: 'offer-source:generation-1',
    lastSuccessfulGenerationAt: '2026-06-19T10:00:00.000Z',
    sourceVersion: 'catalog-v1:campaign-v1',
    cacheCreatedAt: '2026-06-19T09:00:00.000Z',
  };
  const offerSourceRepository: PackageOfferSourceRepository = {
    getOfferSource: jest.fn().mockResolvedValue(options.emptyCache ? null : generation),
    refreshOfferSource: options.failRefresh
      ? jest.fn().mockRejectedValue(new Error('offline'))
      : jest.fn().mockResolvedValue(generation),
    getLastSyncTime: jest.fn().mockResolvedValue(generation.lastSuccessfulGenerationAt),
  };
  return offerSourceRepository;
}

describe('PackageSyncProvider', () => {
  test('loads cache immediately and exposes an offline warning when refresh fails', async () => {
    const offerSourceRepository = repository({ failRefresh: true });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider offerSourceRepository={offerSourceRepository}>{children}</PackageSyncProvider>
    );
    const { result } = renderHook(() => usePackageSync(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalog).toEqual(cachedCatalog);
    await waitFor(() => expect(result.current.syncWarning).toBe('Using cached package data'));
  });

  test('refreshes when the app resumes', async () => {
    let appStateListener: ((state: 'active' | 'background') => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as typeof appStateListener;
      return { remove: jest.fn() };
    });
    const offerSourceRepository = repository();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider offerSourceRepository={offerSourceRepository}>{children}</PackageSyncProvider>
    );
    renderHook(() => usePackageSync(), { wrapper });
    await waitFor(() => expect(offerSourceRepository.refreshOfferSource).toHaveBeenCalledTimes(1));

    act(() => {
      appStateListener?.('background');
      appStateListener?.('active');
    });

    await waitFor(() => expect(offerSourceRepository.refreshOfferSource).toHaveBeenCalledTimes(2));
    jest.restoreAllMocks();
  });

  test('manual refresh updates repositories without clearing existing catalog', async () => {
    const offerSourceRepository = repository();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider offerSourceRepository={offerSourceRepository}>{children}</PackageSyncProvider>
    );
    const { result } = renderHook(() => usePackageSync(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.catalog).toEqual(cachedCatalog);
    expect(offerSourceRepository.refreshOfferSource).toHaveBeenCalled();
  });

  test('does not expose a partial generation when refresh fails without cache', async () => {
    const offerSourceRepository = repository({ failRefresh: true, emptyCache: true });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider offerSourceRepository={offerSourceRepository}>{children}</PackageSyncProvider>
    );
    const { result } = renderHook(() => usePackageSync(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalogLoaded).toBe(false);
    expect(result.current.campaignsLoaded).toBe(false);
    expect(result.current.offerSourceReady).toBe(false);
    expect(result.current.syncWarning).toBe('Packages unavailable. Please try again.');
  });
});
