import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { RemoteSavedLocationsRepository, createSavedLocationsShadowRepository } from '../repositories/RemoteSavedLocationsRepository';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import type { SavedLocation, RideLocation } from '@/types';

const homeLocation: SavedLocation = {
  id: 'saved-home',
  label: 'Home',
  address: 'Kigali',
  latitude: -1.9441,
  longitude: 30.0619,
};

const workLocation: SavedLocation = {
  id: 'saved-work',
  label: 'Work',
  address: 'Kacyiru',
  latitude: -1.94,
  longitude: 30.07,
};

const rideLocation: RideLocation = {
  address: 'Nyamirambo',
  latitude: -1.95,
  longitude: 30.05,
};

describe('RemoteSavedLocationsRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('maps list DTOs to domain models', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/saved-locations',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                {
                  id: homeLocation.id,
                  label: homeLocation.label,
                  address: homeLocation.address ?? '',
                  latitude: homeLocation.latitude,
                  longitude: homeLocation.longitude,
                },
              ],
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.list()).resolves.toEqual([homeLocation]);
    expect(transportFixture.calls[0]).toMatchObject({ method: 'GET', path: '/v1/saved-locations' });
  });

  test('maps create DTOs to the backend and back', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/saved-locations',
        response: {
          status: 200,
          data: {
            data: {
              id: workLocation.id,
              label: workLocation.label,
              address: workLocation.address ?? '',
              latitude: workLocation.latitude,
              longitude: workLocation.longitude,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.create(
      rideLocation,
      'Work',
      {
        idempotencyKey: 'saved:create:1',
        correlationId: 'corr-1',
        actorId: 'customer-1',
        actorRole: 'customer',
        clientTimestamp: '2026-07-02T10:00:00.000Z',
        label: 'Work',
        address: rideLocation.address ?? '',
        latitude: rideLocation.latitude,
        longitude: rideLocation.longitude,
      },
    );

    expect(result).toEqual(workLocation);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/saved-locations',
      body: expect.objectContaining({
        label: 'Work',
        address: 'Nyamirambo',
      }),
    });
  });

  test('maps update DTOs correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: `/v1/saved-locations/${homeLocation.id}`,
        response: {
          status: 200,
          data: {
            data: {
              id: homeLocation.id,
              label: 'Home updated',
              address: 'Kimisagara',
              latitude: -1.945,
              longitude: 30.064,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const result = await repo.update(
      { ...homeLocation, label: 'Home updated', address: 'Kimisagara', latitude: -1.945, longitude: 30.064 },
      {
        idempotencyKey: 'saved:update:1',
        correlationId: 'corr-2',
        actorId: 'customer-1',
        actorRole: 'customer',
        clientTimestamp: '2026-07-02T10:00:00.000Z',
        id: homeLocation.id,
        label: 'Home updated',
        address: 'Kimisagara',
        latitude: -1.945,
        longitude: 30.064,
      },
    );

    expect(result).toMatchObject({ label: 'Home updated', address: 'Kimisagara' });
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: `/v1/saved-locations/${homeLocation.id}`,
    });
  });

  test('handles delete success', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'DELETE',
        path: `/v1/saved-locations/${homeLocation.id}`,
        response: {
          status: 200,
          data: {
            data: { deleted: true },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(
      repo.delete(homeLocation.id, {
        idempotencyKey: 'saved:delete:1',
        correlationId: 'corr-3',
        actorId: 'customer-1',
        actorRole: 'customer',
        clientTimestamp: '2026-07-02T10:00:00.000Z',
        id: homeLocation.id,
      }),
    ).resolves.toBeUndefined();
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/v1/saved-locations/${homeLocation.id}`,
    });
  });

  test('maps typed backend errors correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/saved-locations', error: new TimeoutError({ repository: 'savedLocations', method: 'list', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/saved-locations', error: new OfflineError({ repository: 'savedLocations', method: 'create', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'PATCH', path: `/v1/saved-locations/${homeLocation.id}`, error: new ServerError({ repository: 'savedLocations', method: 'update', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemoteSavedLocationsRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemoteSavedLocationsRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemoteSavedLocationsRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.list()).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.create(rideLocation, 'Home', {
      idempotencyKey: 'saved:create:offline',
      correlationId: 'corr-4',
      actorId: 'customer-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
      label: 'Home',
      address: rideLocation.address ?? '',
      latitude: rideLocation.latitude,
      longitude: rideLocation.longitude,
    })).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.update(homeLocation, {
      idempotencyKey: 'saved:update:server',
      correlationId: 'corr-5',
      actorId: 'customer-1',
      actorRole: 'customer',
      clientTimestamp: '2026-07-02T10:00:00.000Z',
      id: homeLocation.id,
      label: homeLocation.label,
      address: homeLocation.address ?? '',
      latitude: homeLocation.latitude,
      longitude: homeLocation.longitude,
    })).rejects.toBeInstanceOf(ServerError);
  });
});

describe('saved locations shadow remote repository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('returns local results even when remote fails', async () => {
    const localRepository = {
      listSavedLocations: jest.fn(async () => [homeLocation]),
      replaceSavedLocations: jest.fn(async () => undefined),
      saveLocation: jest.fn(async () => true),
      removeSavedLocation: jest.fn(async () => undefined),
      clearSavedLocations: jest.fn(async () => undefined),
    };
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/saved-locations', error: new TimeoutError({ repository: 'savedLocations', method: 'list', transport: 'remote' }) },
      { method: 'POST', path: '/v1/saved-locations', error: new TimeoutError({ repository: 'savedLocations', method: 'create', transport: 'remote' }) },
      { method: 'PATCH', path: `/v1/saved-locations/${homeLocation.id}`, error: new TimeoutError({ repository: 'savedLocations', method: 'update', transport: 'remote' }) },
      { method: 'DELETE', path: `/v1/saved-locations/${homeLocation.id}`, error: new TimeoutError({ repository: 'savedLocations', method: 'delete', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createSavedLocationsShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.listSavedLocations()).resolves.toEqual([homeLocation]);
    await expect(shadowRepository.saveLocation(rideLocation, 'Home')).resolves.toBe(true);
    await expect(shadowRepository.removeSavedLocation(homeLocation.id)).resolves.toBeUndefined();

    expect(localRepository.listSavedLocations).toHaveBeenCalled();
    expect(localRepository.saveLocation).toHaveBeenCalled();
    expect(localRepository.removeSavedLocation).toHaveBeenCalled();
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository = {
      listSavedLocations: jest.fn(async () => [homeLocation]),
      replaceSavedLocations: jest.fn(async () => undefined),
      saveLocation: jest.fn(async () => true),
      removeSavedLocation: jest.fn(async () => undefined),
      clearSavedLocations: jest.fn(async () => undefined),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/saved-locations',
        response: {
          status: 200,
          data: {
            data: {
              items: [homeLocation, workLocation],
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteSavedLocationsRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createSavedLocationsShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.listSavedLocations()).resolves.toEqual([homeLocation]);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'saved_locations.remote.shadow',
      'saved_locations.remote.latency_ms',
      'saved_locations.remote.shape_mismatch',
    ]));
  });

  test('default repository mode remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
