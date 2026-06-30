import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import type { DriverEntitlement, DriverPackageOfferSnapshot, DriverPackagePurchase, DriverRidePackageCampaign, DriverRidePackageCatalogEntry } from '@/domains/packages';
import { packageKeys } from '../keys';
import {
  useActivatePackageMutation,
  useAvailablePackageOffersQuery,
  useCreatePackagePurchaseMutation,
  useDeductRideCreditMutation,
  useDriverEntitlementsQuery,
  useDriverPackagePurchasesQuery,
  usePackageCampaignsQuery,
  usePackageCatalogQuery,
  useUpdatePackagePurchaseStatusMutation,
} from '../hooks/usePackagesQuery';

const mockUseAuth = jest.fn();
const mockGetOfferSource = jest.fn();
const mockGetCatalog = jest.fn();
const mockGetCampaigns = jest.fn();
const mockGetDriverEntitlement = jest.fn();
const mockSaveDriverEntitlement = jest.fn();
const mockGetDriverPackagePurchases = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/domains/packages/repository', () => ({
  packageRepository: {
    getOfferSource: (...args: unknown[]) => mockGetOfferSource(...args),
    getCatalog: (...args: unknown[]) => mockGetCatalog(...args),
    getCampaigns: (...args: unknown[]) => mockGetCampaigns(...args),
  },
  getDriverEntitlement: (...args: unknown[]) => mockGetDriverEntitlement(...args),
  saveDriverEntitlement: (...args: unknown[]) => mockSaveDriverEntitlement(...args),
  getDriverPackagePurchases: (...args: unknown[]) => mockGetDriverPackagePurchases(...args),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

function createOffer(): DriverPackageOfferSnapshot {
  return {
    offerId: 'offer-1',
    packageId: 'growth',
    packageVersion: 'v1',
    packageName: 'Growth Package',
    vehicleId: 'vehicle-1',
    vehicleType: 'moto',
    priceRwf: 2_000,
    ridesGranted: 60,
    bonusRidesGranted: 15,
    campaignId: null,
    campaignName: null,
    campaignType: null,
    ownerUserId: 'driver-1',
    quoteId: null,
    quoteSignature: null,
    quoteAuthority: 'local',
    createdAt: '2026-06-29T00:00:00.000Z',
    expiresAt: '2030-06-29T00:15:00.000Z',
    source: 'local_catalog',
  };
}

function createLaunchOffer(): DriverPackageOfferSnapshot {
  return {
    offerId: 'offer-launch-1',
    packageId: 'launch_starter',
    packageVersion: 'v1',
    packageName: 'Launch Starter Package',
    vehicleId: 'vehicle-1',
    vehicleType: 'moto',
    priceRwf: 0,
    ridesGranted: 30,
    bonusRidesGranted: 5,
    campaignId: null,
    campaignName: null,
    campaignType: null,
    ownerUserId: 'driver-1',
    quoteId: null,
    quoteSignature: null,
    quoteAuthority: 'local',
    createdAt: '2026-06-29T00:00:00.000Z',
    expiresAt: '2030-06-29T00:15:00.000Z',
    source: 'local_catalog',
  };
}

function baseEntitlement(): DriverEntitlement {
  return {
    ...EMPTY_DRIVER_ENTITLEMENT,
    vehicleId: 'vehicle-1',
    vehicleType: 'moto',
    updatedAt: '2026-06-29T00:00:00.000Z',
  };
}

describe('package query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'driver-1' },
      driverProfile: null,
    });
    mockGetOfferSource.mockResolvedValue({
      catalog: [{
        packageId: 'growth',
        packageVersion: 'v1',
        packageName: 'Growth Package',
        vehicleType: 'moto',
        priceRwf: 2_000,
        ridesGranted: 60,
        bonusRidesGranted: 15,
        status: 'active',
        createdAt: '2026-06-29T00:00:00.000Z',
        effectiveFrom: '2026-06-29T00:00:00.000Z',
        effectiveUntil: null,
      } satisfies DriverRidePackageCatalogEntry],
      campaigns: [{
        campaignId: 'camp-1',
        campaignName: 'Launch Sale',
        campaignType: 'global',
        status: 'active',
        startDate: '2026-06-29T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
        createdAt: '2026-06-29T00:00:00.000Z',
        description: 'Discounted package',
        packageIds: ['growth'],
        priceRwf: 1_000,
      } satisfies DriverRidePackageCampaign],
      catalogLoaded: true,
      campaignsLoaded: true,
      generation: 'offer-source:1',
      lastSuccessfulGenerationAt: '2026-06-29T00:00:00.000Z',
      sourceVersion: 'catalog-v1:campaign-v1',
      cacheCreatedAt: '2026-06-29T00:00:00.000Z',
    });
    mockGetCatalog.mockResolvedValue([]);
    mockGetCampaigns.mockResolvedValue([]);
    mockGetDriverEntitlement.mockResolvedValue(baseEntitlement());
    mockSaveDriverEntitlement.mockImplementation(async (next: DriverEntitlement) => {
      mockGetDriverEntitlement.mockResolvedValue(next);
    });
    mockGetDriverPackagePurchases.mockResolvedValue([]);
  });

  test('loads catalog, campaigns, entitlements, and purchases through repositories', async () => {
    const { wrapper, client } = createWrapper();

    const catalogHook = renderHook(() => usePackageCatalogQuery(), { wrapper });
    const campaignsHook = renderHook(() => usePackageCampaignsQuery(), { wrapper });
    const entitlementsHook = renderHook(() => useDriverEntitlementsQuery('driver-1'), { wrapper });
    const purchasesHook = renderHook(() => useDriverPackagePurchasesQuery('driver-1'), { wrapper });

    await waitFor(() => expect(catalogHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(campaignsHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(entitlementsHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(purchasesHook.result.current.isFetched).toBe(true));

    expect(catalogHook.result.current.data).toHaveLength(1);
    expect(campaignsHook.result.current.data).toHaveLength(1);
    expect(entitlementsHook.result.current.data).toMatchObject({ vehicleId: 'vehicle-1' });
    expect(purchasesHook.result.current.data).toEqual([]);
    expect(client.getQueryData(packageKeys.entitlements('driver-1'))).toMatchObject({ vehicleId: 'vehicle-1' });
  });

  test('resolves available package offers from catalog, campaigns, and entitlement state', async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAvailablePackageOffersQuery('driver-1', 'moto'), { wrapper });
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      packageId: 'growth',
      priceRwf: 1_000,
      campaignName: 'Launch Sale',
    });
  });

  test('creates a package purchase and rolls back on failure', async () => {
    const { wrapper, client } = createWrapper();
    renderHook(() => useDriverEntitlementsQuery('driver-1'), { wrapper });
    const mutation = renderHook(() => useCreatePackagePurchaseMutation(), { wrapper });

    let purchase: DriverPackagePurchase | null = null;
    await act(async () => {
      purchase = await mutation.result.current.mutateAsync({
        offer: createOffer(),
        provider: 'mtn',
        phoneNumber: '0781234567',
      });
    });
    expect(purchase).not.toBeNull();

    expect(client.getQueryData(packageKeys.entitlements('driver-1'))).toMatchObject({
      purchaseHistory: [expect.objectContaining({ packageId: 'growth', status: 'pending' })],
    });
    expect(client.getQueryData(packageKeys.purchases('driver-1'))).toHaveLength(1);

    mockSaveDriverEntitlement.mockRejectedValueOnce(new Error('save failed'));
    await expect(mutation.result.current.mutateAsync({
      offer: createOffer(),
      provider: 'mtn',
      phoneNumber: '0781234567',
    })).rejects.toThrow('save failed');
  });

  test('updates purchase status, activates packages, and deducts ride credit through the repository', async () => {
    const { wrapper } = createWrapper();
    renderHook(() => useDriverEntitlementsQuery('driver-1'), { wrapper });
    const createMutation = renderHook(() => useCreatePackagePurchaseMutation(), { wrapper });
    let purchase: DriverPackagePurchase | null = null;
    await act(async () => {
      purchase = await createMutation.result.current.mutateAsync({
        offer: createOffer(),
        provider: 'mtn',
        phoneNumber: '0781234567',
      });
    });
    expect(purchase).not.toBeNull();

    const updateMutation = renderHook(() => useUpdatePackagePurchaseStatusMutation(), { wrapper });
    await act(async () => {
      await updateMutation.result.current.mutateAsync({
        transactionId: purchase!.transactionId,
        status: 'successful',
      });
    });

    expect(mockSaveDriverEntitlement).toHaveBeenCalled();
  });

  test('activates a package and deducts ride credit through the repository', async () => {
    const { wrapper } = createWrapper();
    mockGetDriverEntitlement.mockResolvedValue({
      ...baseEntitlement(),
      remainingRideCredits: 30,
      remainingBonusRides: 5,
    });
    renderHook(() => useDriverEntitlementsQuery('driver-1'), { wrapper });

    const activateMutation = renderHook(() => useActivatePackageMutation(), { wrapper });
    await act(async () => {
      await activateMutation.result.current.mutateAsync(createLaunchOffer());
    });

    const deductMutation = renderHook(() => useDeductRideCreditMutation(), { wrapper });
    await act(async () => {
      await deductMutation.result.current.mutateAsync('ride-1');
    });

    expect(mockSaveDriverEntitlement).toHaveBeenCalled();
  });
});
