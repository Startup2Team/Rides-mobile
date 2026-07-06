import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteSearchRepository, createSearchShadowRepository } from '../repositories/RemoteSearchRepository';
import { RemoteMapRepository, createMapShadowRepository } from '../repositories/RemoteMapRepository';
import {
  compareFarePreview,
  compareRoute,
  compareSearchResults,
} from '../repositories/searchMapComparisonPolicy';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from '../contracts/backendErrors';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RouteResult } from '@/services/mapbox';
import type { RideLocation } from '@/types';

const localSearchResult: GeocodeSuggestion = {
  id: 'local-kacyiru',
  place_name: 'Kacyiru, Kigali',
  title: 'Kacyiru',
  subtitle: 'Gasabo',
  coords: { latitude: -1.936, longitude: 30.081 },
  featureType: 'neighborhood',
  source: 'mapbox',
};

const remoteSearchDto = {
  id: 'remote-kacyiru',
  label: 'Kacyiru',
  displayName: 'Kacyiru, Kigali',
  shortName: 'Kacyiru',
  address: 'Kacyiru, Gasabo, Kigali',
  subtitle: 'Gasabo',
  latitude: -1.9362,
  longitude: 30.0811,
  category: 'neighborhood',
  country: 'RW',
  city: 'Kigali',
  district: 'Gasabo',
  confidence: 0.9,
};

const origin = { latitude: -1.9441, longitude: 30.0619 };
const destination = { latitude: -1.95, longitude: 30.08 };

const localRoute: RouteResult = {
  coordinates: [origin, destination],
  distanceMeters: 3_000,
  durationSeconds: 600,
};

const remoteRouteDto = {
  routeId: 'route-1',
  geometry: [origin, destination],
  geometryReference: 'route-ref-1',
  distanceMeters: 3_120,
  durationSeconds: 660,
  bounds: { southwest: origin, northeast: destination },
  steps: [{ distanceMeters: 3_120, durationSeconds: 660, instruction: 'Drive' }],
  transportType: 'moto',
  estimatedAt: '2026-07-03T12:00:00.000Z',
};

const localFarePreview = {
  estimatedAmount: 2_000,
  currency: 'RWF',
  estimateType: 'preview' as const,
  distanceMeters: 3_000,
  durationSeconds: 600,
  transportType: 'moto',
};

function searchEnvelope(items = [remoteSearchDto]) {
  return {
    status: 200,
    data: {
      data: { items, nextCursor: null, hasMore: false },
      version: 'v1',
    },
  };
}

function mapLocalSearchRepository(overrides = {}) {
  return {
    search: jest.fn(async () => [localSearchResult]),
    saveRecentQuery: jest.fn(async () => undefined),
    loadRecentQueries: jest.fn(async () => []),
    clearRecentQueries: jest.fn(async () => undefined),
    searchPlaces: jest.fn(async () => [localSearchResult]),
    autocompletePlaces: jest.fn(async () => [localSearchResult]),
    getPlaceDetail: jest.fn(async () => localSearchResult),
    reverseGeocode: jest.fn(async () => ({
      address: 'Local Kacyiru',
      latitude: localSearchResult.coords.latitude,
      longitude: localSearchResult.coords.longitude,
    })),
    ...overrides,
  };
}

function mapLocalMapRepository(overrides = {}) {
  return {
    reverseGeocode: jest.fn(async () => ({ address: 'Local Kigali', ...origin })),
    getRouteEstimate: jest.fn(async () => localRoute),
    getRoutePreview: jest.fn(async () => localRoute),
    getDistanceEstimate: jest.fn(async () => localRoute.distanceMeters),
    getDurationEstimate: jest.fn(async () => localRoute.durationSeconds),
    getFareEstimatePreview: jest.fn(async () => localFarePreview),
    ...overrides,
  };
}

describe('RemoteSearchRepository', () => {
  beforeEach(() => resetObservabilityForTests());
  afterEach(() => resetObservabilityForTests());

  test('maps search, autocomplete, place detail, and reverse geocode DTOs', async () => {
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/search/places', response: searchEnvelope() },
      { method: 'POST', path: '/v1/search/autocomplete', response: searchEnvelope() },
      { method: 'GET', path: '/v1/search/places/remote-kacyiru', response: { status: 200, data: { data: remoteSearchDto, version: 'v1' } } },
      { method: 'POST', path: '/v1/search/reverse-geocode', response: { status: 200, data: { data: remoteSearchDto, version: 'v1' } } },
    ]);
    const repo = new RemoteSearchRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.searchPlaces({ query: '1 KG 9 Ave, Home', near: origin, limit: 3 })).resolves.toEqual([
      expect.objectContaining({
        id: 'remote-kacyiru',
        title: 'Kacyiru',
        place_name: 'Kacyiru, Kigali',
        coords: expect.objectContaining({ latitude: -1.9362 }),
      }),
    ]);
    await expect(repo.autocompletePlaces({ query: 'Kacyiru' })).resolves.toHaveLength(1);
    await expect(repo.getPlaceDetail('remote-kacyiru')).resolves.toMatchObject({ title: 'Kacyiru' });
    await expect(repo.reverseGeocode(origin)).resolves.toEqual({
      address: 'Kacyiru, Gasabo, Kigali',
      latitude: -1.9362,
      longitude: 30.0811,
    });
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/search/places',
      body: expect.objectContaining({
        query: '1 KG 9 Ave, Home',
        near: origin,
        limit: 3,
      }),
    });
  });

  test('typed search failures map correctly', async () => {
    const cases = [
      new UnauthorizedError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new ForbiddenError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new ValidationError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new RateLimitedError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new TimeoutError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new OfflineError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new ServerError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
      new SerializationError({ repository: 'search', method: 'searchPlaces', transport: 'remote' }),
    ];

    for (const error of cases) {
      const transportFixture = createFakeBackendTransport([
        { method: 'POST', path: '/v1/search/places', error },
      ]);
      await expect(new RemoteSearchRepository({ client: new BackendClient({ transport: transportFixture.transport }) }).searchPlaces({ query: 'Kacyiru' })).rejects.toBeInstanceOf(error.constructor as any);
    }
  });

  test('SHADOW_REMOTE returns local results and does not expose raw address query telemetry', async () => {
    const localRepository = mapLocalSearchRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/search/places', response: searchEnvelope([{ ...remoteSearchDto, label: 'Different ranking' }]) },
      { method: 'POST', path: '/v1/search/autocomplete', response: searchEnvelope() },
      { method: 'GET', path: '/v1/search/places/remote-kacyiru', response: { status: 200, data: { data: remoteSearchDto, version: 'v1' } } },
      { method: 'POST', path: '/v1/search/reverse-geocode', response: { status: 200, data: { data: remoteSearchDto, version: 'v1' } } },
    ]);
    const shadow = createSearchShadowRepository({
      localRepository,
      remoteRepository: new RemoteSearchRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
      enableRemoteDiagnostics: true,
    });

    await expect(shadow.searchPlaces({ query: '123 Private Home Street Kigali', near: origin })).resolves.toEqual([localSearchResult]);
    await expect(shadow.autocompletePlaces({ query: 'Kacyiru' })).resolves.toEqual([localSearchResult]);
    await expect(shadow.getPlaceDetail('remote-kacyiru')).resolves.toEqual(localSearchResult);
    await expect(shadow.reverseGeocode(origin)).resolves.toMatchObject({ address: 'Local Kacyiru' });
    expect(localRepository.saveRecentQuery).not.toHaveBeenCalled();
    const logs = JSON.stringify(observability.logger.getLogs());
    expect(logs).not.toContain('123 Private Home Street Kigali');
    expect(logs).toContain('queryLength');
  });

  test('semantic overlap comparison tolerates ranking differences', () => {
    const local = [
      localSearchResult,
      { ...localSearchResult, id: 'local-2', title: 'Convention Centre', coords: { latitude: -1.95, longitude: 30.09 } },
    ];
    const remote = [
      { ...localSearchResult, id: 'remote-2', title: 'Convention Centre' },
      { ...localSearchResult, id: 'remote-1', title: 'Kacyiru' },
    ];

    expect(compareSearchResults(local, remote).mismatch).toBe(false);
  });
});

describe('RemoteMapRepository', () => {
  beforeEach(() => resetObservabilityForTests());
  afterEach(() => resetObservabilityForTests());

  test('maps route, distance, duration, fare preview, and reverse geocode DTOs', async () => {
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/maps/route-estimate', response: { status: 200, data: { data: remoteRouteDto, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/route-preview', response: { status: 200, data: { data: remoteRouteDto, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/distance-estimate', response: { status: 200, data: { data: { distanceMeters: 3_120 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/duration-estimate', response: { status: 200, data: { data: { durationSeconds: 660 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/fare-estimate', response: { status: 200, data: { data: { estimatedAmount: 2_100, currency: 'RWF', estimateType: 'preview', distanceMeters: 3_120, durationSeconds: 660, transportType: 'moto', pricingVersion: 'preview-v1', expiresAt: '2026-07-03T12:05:00.000Z' }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/reverse-geocode', response: { status: 200, data: { data: { address: 'Remote Kigali', latitude: origin.latitude, longitude: origin.longitude }, version: 'v1' } } },
    ]);
    const repo = new RemoteMapRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.getRouteEstimate({ origin, destination, transportType: 'moto' })).resolves.toEqual(expect.objectContaining({ distanceMeters: 3_120, durationSeconds: 660 }));
    await expect(repo.getRoutePreview({ origin, destination, transportType: 'moto' })).resolves.toEqual(expect.objectContaining({ coordinates: [origin, destination] }));
    await expect(repo.getDistanceEstimate({ origin, destination })).resolves.toBe(3_120);
    await expect(repo.getDurationEstimate({ origin, destination })).resolves.toBe(660);
    await expect(repo.getFareEstimatePreview({ origin, destination, vehicleType: 'moto' })).resolves.toEqual(expect.objectContaining({
      estimatedAmount: 2_100,
      estimateType: 'preview',
      pricingVersion: 'preview-v1',
    }));
    await expect(repo.reverseGeocode(origin)).resolves.toEqual({ address: 'Remote Kigali', ...origin });
  });

  test('typed map failures map correctly', async () => {
    const cases = [
      new UnauthorizedError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new ForbiddenError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new ValidationError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new RateLimitedError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new TimeoutError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new OfflineError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new ServerError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
      new SerializationError({ repository: 'map', method: 'getRouteEstimate', transport: 'remote' }),
    ];

    for (const error of cases) {
      const transportFixture = createFakeBackendTransport([
        { method: 'POST', path: '/v1/maps/route-estimate', error },
      ]);
      await expect(new RemoteMapRepository({ client: new BackendClient({ transport: transportFixture.transport }) }).getRouteEstimate({ origin, destination })).rejects.toBeInstanceOf(error.constructor as any);
    }
  });

  test('SHADOW_REMOTE returns local route and fare preview, never remote values', async () => {
    const localRepository = mapLocalMapRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/maps/route-estimate', response: { status: 200, data: { data: { ...remoteRouteDto, distanceMeters: 9_000, durationSeconds: 2_400 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/route-preview', response: { status: 200, data: { data: { ...remoteRouteDto, distanceMeters: 9_000, durationSeconds: 2_400 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/distance-estimate', response: { status: 200, data: { data: { distanceMeters: 9_000 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/duration-estimate', response: { status: 200, data: { data: { durationSeconds: 2_400 }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/fare-estimate', response: { status: 200, data: { data: { estimatedAmount: 9_000, currency: 'RWF', estimateType: 'preview' }, version: 'v1' } } },
      { method: 'POST', path: '/v1/maps/reverse-geocode', response: { status: 200, data: { data: { address: 'Remote Kigali', ...origin }, version: 'v1' } } },
    ]);
    const shadow = createMapShadowRepository({
      localRepository,
      remoteRepository: new RemoteMapRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
      enableRemoteDiagnostics: true,
    });

    await expect(shadow.getRouteEstimate({ origin, destination, transportType: 'moto' })).resolves.toEqual(localRoute);
    await expect(shadow.getRoutePreview({ origin, destination, transportType: 'moto' })).resolves.toEqual(localRoute);
    await expect(shadow.getDistanceEstimate({ origin, destination })).resolves.toBe(localRoute.distanceMeters);
    await expect(shadow.getDurationEstimate({ origin, destination })).resolves.toBe(localRoute.durationSeconds);
    await expect(shadow.getFareEstimatePreview({ origin, destination, vehicleType: 'moto' })).resolves.toEqual(localFarePreview);
    await expect(shadow.reverseGeocode(origin)).resolves.toEqual({ address: 'Local Kigali', ...origin });
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'map.remote.shadow',
      'map.remote.semantic_mismatch',
      'map.remote.distance_mismatch',
      'map.remote.duration_mismatch',
      'map.remote.fare_preview_mismatch',
    ]));
  });

  test('route and fare tolerances avoid false critical mismatches for expected drift', () => {
    expect(compareRoute(localRoute, { ...localRoute, distanceMeters: 3_120, durationSeconds: 660 }).mismatch).toBe(false);
    expect(compareRoute(localRoute, { ...localRoute, distanceMeters: 6_000, durationSeconds: 1_800 }).mismatch).toBe(true);
    expect(compareFarePreview(localFarePreview, { ...localFarePreview, estimatedAmount: 2_100 }).mismatch).toBe(false);
    expect(compareFarePreview(localFarePreview, { ...localFarePreview, estimatedAmount: 4_000 }).mismatch).toBe(true);
  });

  test('telemetry avoids exact route geometry and precise coordinates', async () => {
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/maps/route-estimate', response: { status: 200, data: { data: remoteRouteDto, version: 'v1' } } },
    ]);
    const repo = new RemoteMapRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await repo.getRouteEstimate({ origin, destination });

    const logs = JSON.stringify(observability.logger.getLogs());
    expect(logs).not.toContain(JSON.stringify(remoteRouteDto.geometry));
    expect(logs).not.toContain(String(origin.latitude));
    expect(logs).not.toContain(String(destination.longitude));
    expect(logs).toContain('originBucket');
  });
});

describe('search and map architecture boundaries', () => {
  test('LOCAL default and side-effect boundaries remain unchanged', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });

  test('shadow wrappers do not expose booking matching navigation realtime payment or RideProvider hooks', () => {
    expect(new RemoteSearchRepository()).not.toHaveProperty('createBooking');
    expect(new RemoteMapRepository()).not.toHaveProperty('dispatchRideCommand');
    expect(new RemoteMapRepository()).not.toHaveProperty('startNavigation');
    expect(new RemoteMapRepository()).not.toHaveProperty('streamDriverLocation');
    expect(new RemoteMapRepository()).not.toHaveProperty('authorizePayment');
  });
});
