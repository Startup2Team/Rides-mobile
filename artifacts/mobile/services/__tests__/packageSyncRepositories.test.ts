import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedPackageCampaignRepository,
  CachedPackageCatalogRepository,
  CachedPackageOfferSourceRepository,
  type PackageCampaignBackendAdapter,
  type PackageCatalogBackendAdapter,
} from '../packageSyncRepositories';
import {
  loadPackageCampaignCache,
  loadPackageCatalogCache,
  loadPackageOfferSourceCache,
  savePackageCampaignCache,
  savePackageCatalogCache,
} from '@/persistence/packageSyncPersistence';
import {
  createPackageOfferSnapshot,
  parsePackageOfferSnapshot,
  serializePackageOfferSnapshot,
} from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';

const catalog = [{
  packageId: 'moto_premium',
  packageVersion: 'v1',
  packageName: 'Moto Premium',
  vehicleType: 'moto' as const,
  priceRwf: 5_000,
  ridesGranted: 100,
  bonusRidesGranted: 25,
  status: 'active' as const,
  createdAt: '2026-06-19T00:00:00.000Z',
  effectiveFrom: '2026-06-19T00:00:00.000Z',
  effectiveUntil: null,
}];

const campaigns = [{
  campaignId: 'weekend',
  campaignName: 'Weekend',
  campaignType: 'global' as const,
  status: 'active' as const,
  startDate: '2026-06-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  description: 'Weekend offer',
  packageIds: ['moto_premium'],
  priceRwf: 4_000,
}];

describe('package sync repositories', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('loads catalog and campaign caches after restart', async () => {
    await savePackageCatalogCache({
      data: catalog,
      lastSyncedAt: '2026-06-19T10:00:00.000Z',
      sourceVersion: 'catalog-v1',
      cacheCreatedAt: '2026-06-19T09:00:00.000Z',
    });
    await savePackageCampaignCache({
      data: campaigns,
      lastSyncedAt: '2026-06-19T10:00:00.000Z',
      sourceVersion: 'campaign-v1',
      cacheCreatedAt: '2026-06-19T09:00:00.000Z',
    });

    await expect(new CachedPackageCatalogRepository().getCatalog()).resolves.toEqual(catalog);
    await expect(new CachedPackageCampaignRepository().getCampaigns()).resolves.toEqual(campaigns);
  });

  test('successful refresh validates and persists data with sync metadata', async () => {
    const catalogAdapter: PackageCatalogBackendAdapter = {
      fetchPackages: jest.fn().mockResolvedValue({ data: catalog, sourceVersion: 'catalog-v2' }),
    };
    const campaignAdapter: PackageCampaignBackendAdapter = {
      fetchCampaigns: jest.fn().mockResolvedValue({ data: campaigns, sourceVersion: 'campaign-v2' }),
    };
    const now = () => new Date('2026-06-19T11:00:00.000Z');

    await new CachedPackageCatalogRepository(catalogAdapter, now).refreshCatalog();
    await new CachedPackageCampaignRepository(campaignAdapter, now).refreshCampaigns();

    await expect(loadPackageCatalogCache()).resolves.toMatchObject({
      data: {
        data: catalog,
        lastSyncedAt: '2026-06-19T11:00:00.000Z',
        sourceVersion: 'catalog-v2',
        cacheCreatedAt: '2026-06-19T11:00:00.000Z',
      },
    });
    await expect(loadPackageCampaignCache()).resolves.toMatchObject({
      data: {
        data: campaigns,
        sourceVersion: 'campaign-v2',
      },
    });
  });

  test('failed refresh preserves cached offline data', async () => {
    await savePackageCatalogCache({
      data: catalog,
      lastSyncedAt: '2026-06-19T10:00:00.000Z',
      sourceVersion: 'catalog-v1',
      cacheCreatedAt: '2026-06-19T09:00:00.000Z',
    });
    const adapter: PackageCatalogBackendAdapter = {
      fetchPackages: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const repository = new CachedPackageCatalogRepository(adapter);

    await expect(repository.refreshCatalog()).rejects.toThrow('offline');
    await expect(repository.getCatalog()).resolves.toEqual(catalog);
    await expect(repository.getLastSyncTime()).resolves.toBe('2026-06-19T10:00:00.000Z');
  });

  test('returns null when no cache exists', async () => {
    await expect(new CachedPackageCatalogRepository().getCatalog()).resolves.toBeNull();
    await expect(new CachedPackageCampaignRepository().getCampaigns()).resolves.toBeNull();
  });

  test('commits catalog and campaigns as one generation', async () => {
    const repository = new CachedPackageOfferSourceRepository(
      { fetchPackages: jest.fn().mockResolvedValue({ data: catalog, sourceVersion: 'catalog-v2' }) },
      { fetchCampaigns: jest.fn().mockResolvedValue({ data: campaigns, sourceVersion: 'campaign-v2' }) },
      () => new Date('2026-06-19T11:00:00.000Z'),
    );

    await repository.refreshOfferSource();

    await expect(loadPackageOfferSourceCache()).resolves.toMatchObject({
      data: {
        catalog,
        campaigns,
        catalogLoaded: true,
        campaignsLoaded: true,
        generation: expect.stringContaining('catalog-v2:campaign-v2'),
        lastSuccessfulGenerationAt: '2026-06-19T11:00:00.000Z',
      },
    });
  });

  test('partial refresh failure preserves the previous complete generation', async () => {
    const initialRepository = new CachedPackageOfferSourceRepository(
      { fetchPackages: jest.fn().mockResolvedValue({ data: catalog, sourceVersion: 'catalog-v1' }) },
      { fetchCampaigns: jest.fn().mockResolvedValue({ data: campaigns, sourceVersion: 'campaign-v1' }) },
      () => new Date('2026-06-19T10:00:00.000Z'),
    );
    const initial = await initialRepository.refreshOfferSource();
    const changedCatalog = [{ ...catalog[0], priceRwf: 99_000 }];
    const failingRepository = new CachedPackageOfferSourceRepository(
      { fetchPackages: jest.fn().mockResolvedValue({ data: changedCatalog, sourceVersion: 'catalog-v2' }) },
      { fetchCampaigns: jest.fn().mockRejectedValue(new Error('campaign offline')) },
    );

    await expect(failingRepository.refreshOfferSource()).rejects.toThrow('campaign offline');
    await expect(failingRepository.getOfferSource()).resolves.toEqual(initial);
  });

  test('catalog and campaign refreshes cannot mutate an existing locked offer', async () => {
    const originalOffer = resolvePackageOffer({
      package: catalog[0],
      vehicleType: 'moto',
      activeCampaigns: campaigns,
      now: new Date('2026-06-19T10:00:00.000Z'),
    });
    const locked = createPackageOfferSnapshot(
      originalOffer,
      { vehicleId: 'vehicle-moto-1', vehicleType: 'moto' },
      new Date('2026-06-19T10:00:00.000Z'),
    );
    const serialized = serializePackageOfferSnapshot(locked);
    const changedCatalog = [{ ...catalog[0], priceRwf: 9_000, ridesGranted: 300 }];
    const changedCampaigns = [{ ...campaigns[0], priceRwf: 500, ridesGranted: 500 }];

    await new CachedPackageCatalogRepository({
      fetchPackages: jest.fn().mockResolvedValue({ data: changedCatalog, sourceVersion: 'catalog-v3' }),
    }).refreshCatalog();
    await new CachedPackageCampaignRepository({
      fetchCampaigns: jest.fn().mockResolvedValue({ data: changedCampaigns, sourceVersion: 'campaign-v3' }),
    }).refreshCampaigns();

    expect(parsePackageOfferSnapshot(serialized)).toMatchObject({
      offerId: locked.offerId,
      priceRwf: 4_000,
      ridesGranted: 100,
      bonusRidesGranted: 25,
      campaignId: 'weekend',
    });
  });
});
