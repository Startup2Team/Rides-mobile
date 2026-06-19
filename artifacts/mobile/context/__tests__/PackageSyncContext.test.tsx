import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';
import { PackageSyncProvider, usePackageSync } from '../PackageSyncContext';
import type {
  PackageCampaignRepository,
  PackageCatalogRepository,
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

function repositories(options: { failRefresh?: boolean; emptyCache?: boolean } = {}) {
  const catalogRepository: PackageCatalogRepository = {
    getCatalog: jest.fn().mockResolvedValue(options.emptyCache ? null : cachedCatalog),
    refreshCatalog: options.failRefresh
      ? jest.fn().mockRejectedValue(new Error('offline'))
      : jest.fn().mockResolvedValue(cachedCatalog),
    getLastSyncTime: jest.fn().mockResolvedValue('2026-06-19T10:00:00.000Z'),
  };
  const campaignRepository: PackageCampaignRepository = {
    getCampaigns: jest.fn().mockResolvedValue(options.emptyCache ? null : []),
    refreshCampaigns: options.failRefresh
      ? jest.fn().mockRejectedValue(new Error('offline'))
      : jest.fn().mockResolvedValue([]),
    getLastSyncTime: jest.fn().mockResolvedValue('2026-06-19T10:00:00.000Z'),
  };
  return { catalogRepository, campaignRepository };
}

describe('PackageSyncProvider', () => {
  test('loads cache immediately and exposes an offline warning when refresh fails', async () => {
    const repos = repositories({ failRefresh: true });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider {...repos}>{children}</PackageSyncProvider>
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
    const repos = repositories();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider {...repos}>{children}</PackageSyncProvider>
    );
    renderHook(() => usePackageSync(), { wrapper });
    await waitFor(() => expect(repos.catalogRepository.refreshCatalog).toHaveBeenCalledTimes(1));

    act(() => {
      appStateListener?.('background');
      appStateListener?.('active');
    });

    await waitFor(() => expect(repos.catalogRepository.refreshCatalog).toHaveBeenCalledTimes(2));
    jest.restoreAllMocks();
  });

  test('manual refresh updates repositories without clearing existing catalog', async () => {
    const repos = repositories();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PackageSyncProvider {...repos}>{children}</PackageSyncProvider>
    );
    const { result } = renderHook(() => usePackageSync(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.catalog).toEqual(cachedCatalog);
    expect(repos.catalogRepository.refreshCatalog).toHaveBeenCalled();
  });
});
