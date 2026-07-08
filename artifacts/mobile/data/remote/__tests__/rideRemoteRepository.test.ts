import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteRideRepository, createRideReadOnlyShadowRepository } from '../repositories/RemoteRideRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { NotImplementedError, ServerError, TimeoutError } from '../contracts/backendErrors';
import type { ActiveRideReadModel, RideHistoryReadModel } from '@/domains/ride/readModels';
import type { Ride } from '@/types';
import type { RideRepository } from '@/data/repositories/interfaces';

const activeRideDto: ActiveRideReadModel = {
  rideId: 'ride-active-1',
  status: 'driver_en_route',
  phase: 'accepted',
  customer: { userId: 'customer-1', role: 'customer', displayName: 'Customer One' },
  driver: { userId: 'driver-1', role: 'driver', displayName: 'Driver One' },
  pickup: { address: 'Kimironko', latitude: -1.936, longitude: 30.13 },
  destination: { address: 'Nyamirambo', latitude: -1.98, longitude: 30.04 },
  fare: { amount: 2500, currency: 'RWF', source: 'negotiated' },
  etaMinutes: 4,
  updatedAt: '2026-07-03T08:30:00.000Z',
  sequenceNumber: 7,
  projection: { appliedEventIds: ['evt-1'] },
};

const historyRideDto: RideHistoryReadModel & {
  vehicleType: 'moto';
  distanceKm: number;
  durationMinutes: number;
} = {
  rideId: 'ride-history-1',
  status: 'completed',
  customer: { userId: 'customer-1', role: 'customer', displayName: 'Customer One' },
  driver: { userId: 'driver-1', role: 'driver', displayName: 'Driver One' },
  pickup: { address: 'Remera', latitude: -1.95, longitude: 30.1 },
  destination: { address: 'Kacyiru', latitude: -1.93, longitude: 30.08 },
  fare: { amount: 1800, currency: 'RWF', source: 'final', finalizedAt: '2026-07-02T10:20:00.000Z' },
  requestedAt: '2026-07-02T10:00:00.000Z',
  completedAt: '2026-07-02T10:20:00.000Z',
  paymentId: 'payment-1',
  paymentAuthorizedAt: '2026-07-02T10:21:00.000Z',
  paymentCompletedAt: '2026-07-02T10:22:00.000Z',
  rating: 5,
  ratingSubmittedAt: '2026-07-02T10:30:00.000Z',
  sequenceNumber: 10,
  projection: { appliedEventIds: ['evt-2'] },
  vehicleType: 'moto',
  distanceKm: 6,
  durationMinutes: 20,
};

const mappedHistoryRide: Ride = {
  id: 'ride-history-1',
  customerId: 'customer-1',
  customerName: 'Customer One',
  driverId: 'driver-1',
  driverName: 'Driver One',
  vehicleType: 'moto',
  requestedVehicleType: 'moto',
  pickup: { address: 'Remera', latitude: -1.95, longitude: 30.1 },
  destination: { address: 'Kacyiru', latitude: -1.93, longitude: 30.08 },
  status: 'completed',
  distance: 6,
  duration: 20,
  suggestedFare: 1800,
  agreedFare: 1800,
  negotiation: [],
  createdAt: '2026-07-02T10:00:00.000Z',
  completedAt: '2026-07-02T10:20:00.000Z',
};

function createLocalRepository(overrides: Partial<RideRepository & { getActiveRide(): Promise<ActiveRideReadModel | null> }> = {}) {
  return {
    appendRideHistory: jest.fn(async () => undefined),
    loadRideHistory: jest.fn(async () => [mappedHistoryRide]),
    getRideDetail: jest.fn(async () => mappedHistoryRide),
    clearRideHistory: jest.fn(async () => undefined),
    getActiveRide: jest.fn(async () => activeRideDto),
    ...overrides,
  };
}

describe('RemoteRideRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('GET active ride maps dto to active read model', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/rides/active',
        response: { status: 200, data: { data: activeRideDto, version: 'v1' } },
      },
    ]);
    const repo = new RemoteRideRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getActiveRide()).resolves.toEqual(activeRideDto);
    expect(transportFixture.calls).toEqual([{ method: 'GET', path: '/v1/rides/active', body: undefined }]);
  });

  test('GET ride history maps dto list to existing ride domain list', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/rides/history',
        response: {
          status: 200,
          data: { data: { items: [historyRideDto], nextCursor: null, hasMore: false }, version: 'v1' },
        },
      },
    ]);
    const repo = new RemoteRideRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.getRideHistory()).resolves.toEqual([mappedHistoryRide]);
    await expect(repo.loadRideHistory()).resolves.toEqual([mappedHistoryRide]);
  });

  test('GET ride detail maps dto to existing ride domain shape', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/rides/ride-history-1',
        response: { status: 200, data: { data: historyRideDto, version: 'v1' } },
      },
    ]);
    const repo = new RemoteRideRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.getRideDetail('ride-history-1')).resolves.toEqual(mappedHistoryRide);
  });

  test('typed backend errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/rides/active', error: new TimeoutError({ repository: 'ride', method: 'getActiveRide', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/rides/history', error: new ServerError({ repository: 'ride', method: 'getRideHistory', transport: 'remote' }) },
    ]);

    await expect(new RemoteRideRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) }).getActiveRide()).rejects.toBeInstanceOf(TimeoutError);
    await expect(new RemoteRideRepository({ client: new BackendClient({ transport: serverTransport.transport }) }).getRideHistory()).rejects.toBeInstanceOf(ServerError);
  });

  test('write methods remain unavailable or not implemented and do not call backend commands', async () => {
    const transportFixture = createFakeBackendTransport([]);
    const repo = new RemoteRideRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.appendRideHistory(mappedHistoryRide)).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.clearRideHistory()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.requestRide()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.cancelRide()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.acceptRide()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.declineRide()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.startRide()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(repo.completeRide()).rejects.toBeInstanceOf(NotImplementedError);
    expect(transportFixture.calls).toEqual([]);
  });
});

describe('ride read-only shadow repository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('LOCAL stays authoritative and SHADOW_REMOTE ignores remote read results', async () => {
    const localRepository = createLocalRepository();
    const remoteHistory = { ...historyRideDto, rideId: 'remote-ride', fare: { amount: 9999, currency: 'RWF', source: 'final' as const } };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/rides/active',
        response: { status: 200, data: { data: { ...activeRideDto, rideId: 'remote-active' }, version: 'v1' } },
      },
      {
        method: 'GET',
        path: '/v1/rides/history',
        response: { status: 200, data: { data: { items: [remoteHistory] }, version: 'v1' } },
      },
      {
        method: 'GET',
        path: '/v1/rides/ride-history-1',
        response: { status: 200, data: { data: remoteHistory, version: 'v1' } },
      },
    ]);
    const shadowRepository = createRideReadOnlyShadowRepository({
      localRepository,
      remoteRepository: new RemoteRideRepository({
        client: new BackendClient({ transport: transportFixture.transport }),
        transportLabel: 'shadow_remote',
      }),
    });

    await expect(shadowRepository.getActiveRide()).resolves.toEqual(activeRideDto);
    await expect(shadowRepository.getRideHistory()).resolves.toEqual([mappedHistoryRide]);
    await expect(shadowRepository.loadRideHistory()).resolves.toEqual([mappedHistoryRide]);
    await expect(shadowRepository.getRideDetail('ride-history-1')).resolves.toEqual(mappedHistoryRide);

    expect(localRepository.loadRideHistory).toHaveBeenCalled();
    expect(localRepository.getRideDetail).toHaveBeenCalledWith('ride-history-1');
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.remote.shadow',
      'ride.remote.latency_ms',
      'ride.remote.semantic_mismatch',
    ]));
    expect(transportFixture.calls.map(call => call.method)).toEqual(['GET', 'GET', 'GET', 'GET']);
    expect(transportFixture.calls.map(call => call.path).some(path => path.includes('payments') || path.includes('realtime') || path.includes('commands'))).toBe(false);
  });

  test('REMOTE errors are telemetry only after LOCAL succeeds', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/rides/history', error: new TimeoutError({ repository: 'ride', method: 'getRideHistory', transport: 'remote' }) },
    ]);
    const shadowRepository = createRideReadOnlyShadowRepository({
      localRepository,
      remoteRepository: new RemoteRideRepository({ client: new BackendClient({ transport: transportFixture.transport }) }),
    });

    await expect(shadowRepository.getRideHistory()).resolves.toEqual([mappedHistoryRide]);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining(['ride.remote.shadow']));
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
