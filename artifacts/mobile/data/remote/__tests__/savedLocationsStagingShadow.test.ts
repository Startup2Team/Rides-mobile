import type { SavedLocation, RideLocation } from '@/types';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  createSavedLocationsStagingShadowRepository,
  resolveSavedLocationsStagingShadowConfig,
} from '../staging/createSavedLocationsStagingShadow';

const homeLocation: SavedLocation = {
  id: 'local-home',
  label: 'Home',
  address: 'Kigali',
  latitude: -1.9441,
  longitude: 30.0619,
};

const rideLocation: RideLocation = {
  address: 'Kigali',
  latitude: -1.9441,
  longitude: 30.0619,
};

function makeLocalRepository() {
  return {
    listSavedLocations: jest.fn(async () => [homeLocation]),
    replaceSavedLocations: jest.fn(async () => undefined),
    saveLocation: jest.fn(async () => true),
    removeSavedLocation: jest.fn(async () => undefined),
    clearSavedLocations: jest.fn(async () => undefined),
  };
}

function stagingEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    nodeEnv: 'development',
    backendEnv: 'STAGING',
    backendBaseUrl: 'https://staging.example.invalid',
    savedLocationsRepositoryMode: 'SHADOW_REMOTE',
    savedLocationsShadowWritesEnabled: undefined,
    ...overrides,
  };
}

function savedLocationsListResponse(items: unknown[]) {
  return new Response(JSON.stringify({ data: { items }, version: 'v1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Saved Locations staging shadow integration', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('default and invalid configuration remain LOCAL', () => {
    expect(resolveSavedLocationsStagingShadowConfig({ nodeEnv: 'development' })).toMatchObject({ enabled: false, mode: 'LOCAL' });
    expect(resolveSavedLocationsStagingShadowConfig(stagingEnv({ savedLocationsRepositoryMode: 'REMOTE' }))).toMatchObject({ enabled: false, mode: 'LOCAL' });
    expect(resolveSavedLocationsStagingShadowConfig(stagingEnv({ backendBaseUrl: 'not-a-url' }))).toMatchObject({ enabled: false, mode: 'LOCAL', reason: 'malformed-url' });
    expect(resolveSavedLocationsStagingShadowConfig(stagingEnv({ backendEnv: 'PRODUCTION' }))).toMatchObject({ enabled: false, mode: 'LOCAL' });
  });

  test('production cannot accidentally use staging shadow configuration', () => {
    expect(resolveSavedLocationsStagingShadowConfig(stagingEnv({ nodeEnv: 'production' }))).toMatchObject({
      enabled: false,
      mode: 'LOCAL',
      reason: 'production-shadow-disabled',
    });
  });

  test('creates HTTP transport only when SHADOW_REMOTE staging is explicitly enabled', async () => {
    const localRepository = makeLocalRepository();
    const fetchImpl = jest.fn(async () => savedLocationsListResponse([]));
    const result = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    expect(result.mode).toBe('SHADOW_REMOTE');
    await expect(result.repository.listSavedLocations()).resolves.toEqual([homeLocation]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('missing backend configuration falls back LOCAL and does not create fetch traffic', async () => {
    const localRepository = makeLocalRepository();
    const fetchImpl = jest.fn();
    const result = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv({ backendBaseUrl: undefined }),
      fetchImpl,
    });

    expect(result.mode).toBe('LOCAL');
    await expect(result.repository.listSavedLocations()).resolves.toEqual([homeLocation]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'saved_locations.staging_shadow.config' }),
    ]));
  });

  test('local read remains authoritative when staging succeeds, fails, or mismatches', async () => {
    const localRepository = makeLocalRepository();
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(savedLocationsListResponse([{ ...homeLocation, id: 'remote-home' }]))
      .mockResolvedValueOnce(savedLocationsListResponse([{ ...homeLocation, id: 'remote-home' }, { ...homeLocation, id: 'remote-work', label: 'Work' }]))
      .mockRejectedValueOnce(new TypeError('Network request failed'));
    const result = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    await expect(result.repository.listSavedLocations()).resolves.toEqual([homeLocation]);
    await expect(result.repository.listSavedLocations()).resolves.toEqual([homeLocation]);
    await expect(result.repository.listSavedLocations()).resolves.toEqual([homeLocation]);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'saved_locations.staging_shadow',
      'saved_locations.remote.shape_mismatch',
    ]));
  });

  test('shadow writes are disabled by default and remote results are ignored when enabled', async () => {
    const localRepository = makeLocalRepository();
    const disabledFetch = jest.fn(async () => savedLocationsListResponse([]));
    const disabled = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl: disabledFetch,
    });

    await expect(disabled.repository.saveLocation(rideLocation, 'Home')).resolves.toBe(true);
    await expect(disabled.repository.replaceSavedLocations([homeLocation])).resolves.toBeUndefined();
    await expect(disabled.repository.removeSavedLocation(homeLocation.id)).resolves.toBeUndefined();
    expect(disabledFetch).not.toHaveBeenCalled();

    const enabledFetch = jest.fn()
      .mockResolvedValueOnce(savedLocationsListResponse([]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'remote-created', label: 'Home', address: 'Kigali', latitude: -1.9441, longitude: 30.0619 },
        version: 'v1',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(savedLocationsListResponse([homeLocation]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: homeLocation.id, label: 'Home', address: 'Kigali', latitude: -1.9441, longitude: 30.0619 },
        version: 'v1',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(savedLocationsListResponse([homeLocation]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { deleted: true }, version: 'v1' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const enabled = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv({ savedLocationsShadowWritesEnabled: 'true' }),
      fetchImpl: enabledFetch,
    });

    await expect(enabled.repository.saveLocation(rideLocation, 'Home')).resolves.toBe(true);
    await expect(enabled.repository.replaceSavedLocations([homeLocation])).resolves.toBeUndefined();
    await expect(enabled.repository.clearSavedLocations()).resolves.toBeUndefined();
    expect(enabledFetch).toHaveBeenCalled();
  });
});
