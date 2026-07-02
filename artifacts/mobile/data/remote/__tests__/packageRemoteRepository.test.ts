import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemotePackageRepository, createPackageShadowRepository } from '../repositories/RemotePackageRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import type {
  DriverEntitlement,
  DriverPackageOfferSnapshot,
  DriverPackagePurchase,
  PackageActivation,
  DriverCreditTransaction,
} from '@/domain/driverRidePackages';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import type { PackageOfferSourceCache } from '@/persistence/packageSyncPersistence';
import type { PackageRepository } from '@/data/repositories/interfaces';

const catalogEntry: DriverRidePackageCatalogEntry = {
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
  compareAtPriceRwf: 3_000,
};

const campaign: DriverRidePackageCampaign = {
  campaignId: 'camp-1',
  campaignName: 'Launch Sale',
  campaignType: 'global',
  status: 'active',
  startDate: '2026-06-29T00:00:00.000Z',
  endDate: '2026-07-30T00:00:00.000Z',
  createdAt: '2026-06-29T00:00:00.000Z',
  description: 'Discounted package',
  packageIds: ['growth'],
  priceRwf: 1_000,
  ridesGranted: 80,
  bonusRidesGranted: 20,
};

const offer: DriverPackageOfferSnapshot = {
  offerId: 'offer-1',
  packageId: 'growth',
  packageVersion: 'v1',
  packageName: 'Growth Package',
  vehicleId: 'vehicle-1',
  vehicleType: 'moto',
  priceRwf: 1_000,
  ridesGranted: 80,
  bonusRidesGranted: 20,
  campaignId: 'camp-1',
  campaignName: 'Launch Sale',
  campaignType: 'global',
  ownerUserId: 'driver-1',
  quoteId: 'quote-1',
  quoteSignature: 'sig-1',
  quoteAuthority: 'local',
  createdAt: '2026-07-02T10:00:00.000Z',
  expiresAt: '2099-07-02T10:15:00.000Z',
  source: 'local_catalog',
};

const launchOffer: DriverPackageOfferSnapshot = {
  offerId: 'launch-offer-1',
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
  quoteId: 'quote-launch-1',
  quoteSignature: 'sig-launch-1',
  quoteAuthority: 'local',
  createdAt: '2026-07-02T10:00:00.000Z',
  expiresAt: '2099-07-02T10:15:00.000Z',
  source: 'local_catalog',
};

const activation: PackageActivation = {
  id: 'activation-1',
  packageId: 'growth',
  packageVersion: 'v1',
  packageName: 'Growth Package',
  campaignId: 'camp-1',
  campaignName: 'Launch Sale',
  campaignType: 'global',
  campaignStatus: 'active',
  vehicleId: 'vehicle-1',
  vehicleType: 'moto',
  activatedAt: '2026-07-02T10:10:00.000Z',
  pricePaidRwf: 1_000,
  pricePaid: 1_000,
  ridesGranted: 80,
  bonusRidesGranted: 20,
  purchasedAt: '2026-07-02T10:10:00.000Z',
  creditsGranted: 100,
  authority: 'local_prototype',
};

const creditTransaction: DriverCreditTransaction = {
  id: 'credit-1',
  type: 'debit',
  vehicleId: 'vehicle-1',
  vehicleType: 'moto',
  amount: -1,
  createdAt: '2026-07-02T10:20:00.000Z',
  completedRideId: 'ride-1',
  idempotencyKey: 'package:deduct:1',
  authority: 'local_prototype',
};

const purchase: DriverPackagePurchase = {
  offerId: 'offer-1',
  packageId: 'growth',
  packageVersion: 'v1',
  packageName: 'Growth Package',
  campaignId: 'camp-1',
  campaignName: 'Launch Sale',
  campaignType: 'global',
  campaignStatus: 'active',
  vehicleId: 'vehicle-1',
  vehicleType: 'moto',
  amount: 1_000,
  pricePaid: 1_000,
  ridesGranted: 80,
  bonusRidesGranted: 20,
  purchasedAt: '2026-07-02T10:05:00.000Z',
  provider: 'mtn',
  phoneNumber: '0781234567',
  transactionId: 'txn-1',
  status: 'pending',
  createdAt: '2026-07-02T10:05:00.000Z',
};

const entitlement: DriverEntitlement = {
  ...EMPTY_DRIVER_ENTITLEMENT,
  vehicleId: 'vehicle-1',
  vehicleType: 'moto',
  activePackageId: 'growth',
  remainingRideCredits: 12,
  remainingBonusRides: 3,
  activations: [activation],
  creditTransactions: [creditTransaction],
  purchaseHistory: [purchase],
  vehicleEntitlements: [],
  updatedAt: '2026-07-02T10:20:00.000Z',
  authority: 'local_prototype',
};

const offerSource: PackageOfferSourceCache = {
  catalog: [catalogEntry],
  campaigns: [campaign],
  catalogLoaded: true,
  campaignsLoaded: true,
  generation: 'offer-source:1',
  lastSuccessfulGenerationAt: '2026-07-02T10:00:00.000Z',
  sourceVersion: 'catalog-v1:campaign-v1',
  cacheCreatedAt: '2026-07-02T10:00:00.000Z',
};

function createMetadata(overrides: Partial<{
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: 'customer' | 'driver' | 'system';
  clientTimestamp: string;
}> = {}) {
  return {
    idempotencyKey: 'package:meta:1',
    correlationId: 'corr-package-1',
    actorId: 'driver-1',
    actorRole: 'driver' as const,
    clientTimestamp: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('RemotePackageRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('maps catalog dto to domain', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/catalog',
        response: {
          status: 200,
          data: {
            data: { items: [catalogEntry], nextCursor: null, hasMore: false },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getCatalog()).resolves.toEqual([catalogEntry]);
    expect(transportFixture.calls[0]).toMatchObject({ method: 'GET', path: '/v1/packages/catalog' });
  });

  test('maps campaigns dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/campaigns',
        response: {
          status: 200,
          data: {
            data: { items: [campaign], nextCursor: null, hasMore: false },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getCampaigns()).resolves.toEqual([campaign]);
  });

  test('maps offer source dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/offer-source',
        response: {
          status: 200,
          data: {
            data: offerSource,
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getOfferSource()).resolves.toEqual(offerSource);
  });

  test('maps available offers dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/offers',
        response: {
          status: 200,
          data: {
            data: { items: [offer], nextCursor: null, hasMore: false },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getAvailableOffers({ vehicleId: 'vehicle-1', vehicleType: 'moto', entitlement })).resolves.toEqual([offer]);
  });

  test('maps entitlement dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/entitlements',
        response: {
          status: 200,
          data: {
            data: entitlement,
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getDriverEntitlement(entitlement)).resolves.toEqual(entitlement);
  });

  test('maps purchases dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/purchases',
        response: {
          status: 200,
          data: {
            data: { items: [purchase], nextCursor: null, hasMore: false },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getDriverPackagePurchases(entitlement)).resolves.toEqual([purchase]);
  });

  test('create purchase maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/packages/purchases',
        response: {
          status: 200,
          data: {
            data: {
              entitlement,
              purchase,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.createPurchase({
      entitlement,
      offer,
      provider: 'mtn',
      phoneNumber: '0781234567',
      metadata: createMetadata(),
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    });

    expect(result.purchase).toEqual(purchase);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/packages/purchases',
      body: expect.objectContaining({
        packageId: 'growth',
        idempotencyKey: 'package:meta:1',
      }),
    });
  });

  test('update purchase status maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/packages/purchases/txn-1/status',
        response: {
          status: 200,
          data: {
            data: {
              entitlement: {
                ...entitlement,
                purchaseHistory: [{ ...purchase, status: 'successful', completedAt: '2026-07-02T10:15:00.000Z' }],
              },
              purchase: { ...purchase, status: 'successful', completedAt: '2026-07-02T10:15:00.000Z' },
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.updatePurchaseStatus({
      entitlement,
      transactionId: 'txn-1',
      status: 'successful',
      metadata: createMetadata(),
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    });

    expect(result.purchase).toMatchObject({ status: 'successful' });
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/packages/purchases/txn-1/status',
      body: expect.objectContaining({ transactionId: 'txn-1', status: 'successful' }),
    });
  });

  test('activate package maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/packages/purchases/offer-1/activate',
        response: {
          status: 200,
          data: {
            data: {
              entitlement,
              activation,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.activatePackage({
      entitlement,
      offer,
      metadata: createMetadata(),
      purchaseId: 'offer-1',
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    });

    expect(result.activation).toEqual(activation);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/packages/purchases/offer-1/activate',
    });
  });

  test('deduct credit maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/packages/credits/deduct',
        response: {
          status: 200,
          data: {
            data: {
              entitlement: {
                ...entitlement,
                remainingRideCredits: 11,
                creditTransactions: [...entitlement.creditTransactions, creditTransaction],
              },
              deducted: true,
              creditTransaction,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.deductRideCredit({
      entitlement,
      rideId: 'ride-1',
      vehicleId: 'vehicle-1',
      vehicleType: 'moto',
      credits: 1,
      metadata: createMetadata(),
      packageActivationId: 'activation-1',
    });

    expect(result.deducted).toBe(true);
    expect(result.entitlement.authority).toBe('local_prototype');
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/packages/credits/deduct',
      body: expect.objectContaining({
        rideId: 'ride-1',
        credits: 1,
      }),
    });
  });

  test('typed backend errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/packages/catalog', error: new TimeoutError({ repository: 'package', method: 'getCatalog', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/packages/campaigns', error: new OfflineError({ repository: 'package', method: 'getCampaigns', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/packages/purchases', error: new ServerError({ repository: 'package', method: 'createPurchase', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemotePackageRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemotePackageRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemotePackageRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.getCatalog()).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.getCampaigns()).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.createPurchase({
      entitlement,
      offer,
      provider: 'mtn',
      phoneNumber: '0781234567',
      metadata: createMetadata(),
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    })).rejects.toBeInstanceOf(ServerError);
  });
});

describe('package shadow remote repository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  function createLocalRepository(overrides: Partial<PackageRepository> = {}): PackageRepository {
    return {
      getCatalog: jest.fn(async () => [catalogEntry]),
      refreshCatalog: jest.fn(async () => [catalogEntry]),
      getCampaigns: jest.fn(async () => [campaign]),
      refreshCampaigns: jest.fn(async () => [campaign]),
      getOfferSource: jest.fn(async () => offerSource),
      refreshOfferSource: jest.fn(async () => offerSource),
      ...overrides,
    };
  }

  test('returns local result even when remote fails', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/packages/catalog', error: new TimeoutError({ repository: 'package', method: 'getCatalog', transport: 'remote' }) },
      { method: 'GET', path: '/v1/packages/campaigns', error: new TimeoutError({ repository: 'package', method: 'getCampaigns', transport: 'remote' }) },
      { method: 'GET', path: '/v1/packages/offer-source', error: new TimeoutError({ repository: 'package', method: 'getOfferSource', transport: 'remote' }) },
      { method: 'GET', path: '/v1/packages/offers', error: new TimeoutError({ repository: 'package', method: 'getAvailableOffers', transport: 'remote' }) },
      { method: 'GET', path: '/v1/packages/entitlements', error: new TimeoutError({ repository: 'package', method: 'getDriverEntitlement', transport: 'remote' }) },
      { method: 'GET', path: '/v1/packages/purchases', error: new TimeoutError({ repository: 'package', method: 'getDriverPackagePurchases', transport: 'remote' }) },
      { method: 'POST', path: '/v1/packages/purchases', error: new TimeoutError({ repository: 'package', method: 'createPurchase', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/packages/purchases/txn-1/status', error: new TimeoutError({ repository: 'package', method: 'updatePurchaseStatus', transport: 'remote' }) },
      { method: 'POST', path: '/v1/packages/purchases/launch-offer-1/activate', error: new TimeoutError({ repository: 'package', method: 'activatePackage', transport: 'remote' }) },
      { method: 'POST', path: '/v1/packages/credits/deduct', error: new TimeoutError({ repository: 'package', method: 'deductRideCredit', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createPackageShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getCatalog()).resolves.toEqual([catalogEntry]);
    await expect(shadowRepository.getCampaigns()).resolves.toEqual([campaign]);
    await expect(shadowRepository.getOfferSource()).resolves.toEqual(offerSource);
    await expect(shadowRepository.getAvailableOffers({ vehicleId: 'vehicle-1', vehicleType: 'moto', entitlement })).resolves.toHaveLength(1);
    await expect(shadowRepository.getAvailablePackageOffers({ vehicleId: 'vehicle-1', vehicleType: 'moto', entitlement })).resolves.toHaveLength(1);
    await expect(shadowRepository.getDriverEntitlement(entitlement)).resolves.toEqual(entitlement);
    await expect(shadowRepository.getDriverEntitlements(entitlement)).resolves.toEqual(entitlement);
    await expect(shadowRepository.getDriverPackagePurchases(entitlement)).resolves.toEqual([purchase]);
    await expect(shadowRepository.getDriverPurchases(entitlement)).resolves.toEqual([purchase]);
    await expect(shadowRepository.createPurchase({
      entitlement,
      offer,
      provider: 'mtn',
      phoneNumber: '0781234567',
      metadata: createMetadata(),
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    })).resolves.toMatchObject({ purchase: expect.objectContaining({ packageId: 'growth', status: 'pending' }) });
    await expect(shadowRepository.updatePurchaseStatus({
      entitlement,
      transactionId: 'txn-1',
      status: 'successful',
      metadata: createMetadata(),
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    })).resolves.toMatchObject({ purchase: expect.objectContaining({ packageId: 'growth', status: 'successful' }) });
    await expect(shadowRepository.activatePackage({
      entitlement,
      offer: launchOffer,
      metadata: createMetadata(),
      purchaseId: 'launch-offer-1',
      vehicle: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
    })).resolves.toMatchObject({ activation: expect.objectContaining({ packageId: 'launch_starter' }) });
    await expect(shadowRepository.deductRideCredit({
      entitlement,
      rideId: 'ride-1',
      vehicleId: 'vehicle-1',
      vehicleType: 'moto',
      credits: 1,
      metadata: createMetadata(),
      packageActivationId: 'activation-1',
    })).resolves.toMatchObject({ deducted: true });

    expect(localRepository.getCatalog).toHaveBeenCalled();
    expect(localRepository.getCampaigns).toHaveBeenCalled();
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/packages/catalog',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                { ...catalogEntry, priceRwf: 9_999 },
                { ...catalogEntry, packageId: 'pro', packageName: 'Pro Package' },
              ],
              nextCursor: null,
              hasMore: false,
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/packages/offer-source',
        response: {
          status: 200,
          data: {
            data: {
              ...offerSource,
              catalog: [
                { ...catalogEntry, priceRwf: 9_999 },
                { ...catalogEntry, packageId: 'pro', packageName: 'Pro Package' },
              ],
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/packages/credits/deduct',
        response: {
          status: 200,
          data: {
            data: {
              entitlement: {
                ...entitlement,
                remainingRideCredits: 11,
              },
              deducted: true,
              creditTransaction,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemotePackageRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createPackageShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getCatalog()).resolves.toEqual([catalogEntry]);
    await expect(shadowRepository.getOfferSource()).resolves.toEqual(offerSource);
    await expect(shadowRepository.deductRideCredit({
      entitlement,
      rideId: 'ride-1',
      vehicleId: 'vehicle-1',
      vehicleType: 'moto',
      credits: 1,
      metadata: createMetadata(),
      packageActivationId: 'activation-1',
    })).resolves.toMatchObject({ entitlement: expect.objectContaining({ authority: 'local_prototype' }) });

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'package.remote.shadow',
      'package.remote.latency_ms',
      'package.remote.shape_mismatch',
      'package.remote.semantic_mismatch',
      'package.remote.credit_deduction_shadow_mismatch',
    ]));
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
