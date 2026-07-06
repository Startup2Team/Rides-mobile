import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteVehicleRepository, createVehicleShadowRepository } from '../repositories/RemoteVehicleRepository';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import type { VehicleRepository } from '@/data/repositories/interfaces';
import type { DriverVehicleProfile } from '@/types';

const baseVehicle: DriverVehicleProfile = {
  id: 'vehicle-1',
  vehicleType: 'moto',
  status: 'approved',
  plateNumber: 'RAB 123A',
  licenseNumber: 'LIC-123',
  model: 'Bajaj',
  brand: 'TVS',
  manufactureYear: 2024,
  passengerSeats: 1,
  loadCapacityKg: 100,
  licenseExpiryDate: '2027-01-01',
  insuranceExpiryDate: '2027-02-01',
  authorizationExpiryDate: '2027-03-01',
  photos: {
    outside: 'file://outside.jpg',
    inside: 'file://inside.jpg',
  },
  documents: {
    license: {
      key: 'license',
      faces: ['front', 'back'],
      documentNumber: 'LIC-123',
      expiryDate: '2027-01-01',
      reviewStatus: 'verified',
      submissionKind: 'initial',
      submittedAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    },
    nationalId: {
      key: 'nationalId',
      faces: ['front', 'back'],
      documentNumber: 'NID-123',
      expiryDate: '2027-01-01',
      reviewStatus: 'verified',
      submissionKind: 'initial',
      submittedAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    },
    insurance: {
      key: 'insurance',
      faces: ['front', null],
      documentNumber: 'INS-123',
      expiryDate: '2027-02-01',
      reviewStatus: 'verified',
      submissionKind: 'initial',
      submittedAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    },
    authorization: {
      key: 'authorization',
      faces: ['front', null],
      documentNumber: 'AUTH-123',
      expiryDate: '2027-03-01',
      reviewStatus: 'verified',
      submissionKind: 'initial',
      submittedAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    },
  },
  pendingDocumentUpdate: null,
  submittedAt: '2026-06-28T10:00:00.000Z',
  approvedAt: '2026-06-28T11:00:00.000Z',
  rejectedAt: undefined,
  rejectionReason: undefined,
  reviewHistory: [
    { id: 'review-1', type: 'submitted', at: '2026-06-28T10:00:00.000Z' },
    { id: 'review-2', type: 'under_review', at: '2026-06-28T10:00:00.000Z' },
    { id: 'review-3', type: 'approved', at: '2026-06-28T11:00:00.000Z' },
  ],
};

const secondaryVehicle: DriverVehicleProfile = {
  ...baseVehicle,
  id: 'vehicle-2',
  plateNumber: 'RAB 456B',
  licenseNumber: 'LIC-456',
};

function toVehicleDto(vehicle: DriverVehicleProfile, overrides: Partial<{
  isPrimary: boolean;
  status: DriverVehicleProfile['status'];
}> = {}) {
  return {
    id: vehicle.id,
    vehicleType: vehicle.vehicleType,
    status: overrides.status ?? vehicle.status,
    plateNumber: vehicle.plateNumber,
    licenseNumber: vehicle.licenseNumber,
    model: vehicle.model ?? null,
    brand: vehicle.brand ?? null,
    manufactureYear: vehicle.manufactureYear ?? null,
    passengerSeats: vehicle.passengerSeats ?? null,
    loadCapacityKg: vehicle.loadCapacityKg ?? null,
    licenseExpiryDate: vehicle.licenseExpiryDate ?? null,
    insuranceExpiryDate: vehicle.insuranceExpiryDate ?? null,
    authorizationExpiryDate: vehicle.authorizationExpiryDate ?? null,
    photos: vehicle.photos ?? null,
    documents: vehicle.documents ?? null,
    pendingDocumentUpdate: vehicle.pendingDocumentUpdate ?? null,
    submittedAt: vehicle.submittedAt ?? null,
    approvedAt: vehicle.approvedAt ?? null,
    rejectedAt: vehicle.rejectedAt ?? null,
    rejectionReason: vehicle.rejectionReason ?? null,
    reviewHistory: vehicle.reviewHistory ?? null,
    isPrimary: overrides.isPrimary ?? false,
  };
}

describe('RemoteVehicleRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('maps list DTOs to domain models', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/vehicles',
        response: {
          status: 200,
          data: {
            data: {
              vehicles: [toVehicleDto(baseVehicle)],
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getVehicles()).resolves.toEqual([baseVehicle]);
    await expect(repo.listVehicles()).resolves.toEqual([baseVehicle]);
    expect(transportFixture.calls[0]).toMatchObject({ method: 'GET', path: '/v1/vehicles' });
  });

  test('vehicle detail maps correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/vehicles/vehicle-1',
        response: {
          status: 200,
          data: {
            data: toVehicleDto(baseVehicle),
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getVehicle('vehicle-1')).resolves.toEqual(baseVehicle);
    expect(transportFixture.calls[0]).toMatchObject({ method: 'GET', path: '/v1/vehicles/vehicle-1' });
  });

  test('add vehicle maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/vehicles',
        response: {
          status: 200,
          data: {
            data: toVehicleDto(baseVehicle),
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.addVehicle(baseVehicle)).resolves.toBeUndefined();
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/vehicles',
      body: expect.objectContaining({
        vehicleType: 'moto',
        plateNumber: 'RAB 123A',
        licenseNumber: 'LIC-123',
        idempotencyKey: 'vehicle:add:vehicle-1',
        actorRole: 'driver',
      }),
    });
  });

  test('update vehicle maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/vehicles/vehicle-1',
        response: {
          status: 200,
          data: {
            data: toVehicleDto({ ...baseVehicle, plateNumber: 'RAB 999Z' }),
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const nextVehicle = { ...baseVehicle, plateNumber: 'RAB 999Z' };
    await expect(repo.updateVehicle(nextVehicle)).resolves.toBeUndefined();
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/vehicles/vehicle-1',
      body: expect.objectContaining({
        vehicleId: 'vehicle-1',
        plateNumber: 'RAB 999Z',
        idempotencyKey: 'vehicle:update:vehicle-1',
      }),
    });
  });

  test('delete vehicle handles success', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'DELETE',
        path: '/v1/vehicles/vehicle-1',
        response: {
          status: 200,
          data: {
            data: { deleted: true },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.deleteVehicle('vehicle-1')).resolves.toBeUndefined();
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/v1/vehicles/vehicle-1',
      body: expect.objectContaining({
        vehicleId: 'vehicle-1',
        idempotencyKey: 'vehicle:delete:vehicle-1',
      }),
    });
  });

  test('set primary vehicle maps request and response correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/vehicles/primary',
        response: {
          status: 200,
          data: {
            data: { primaryVehicleId: 'vehicle-1' },
            version: 'v1',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/vehicles/primary',
        response: {
          status: 200,
          data: {
            data: { primaryVehicleId: 'vehicle-2' },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.setPrimaryVehicle('vehicle-1')).resolves.toBeUndefined();
    await expect(repo.setActiveVehicle('vehicle-2')).resolves.toBeUndefined();
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/vehicles/primary',
      body: expect.objectContaining({
        vehicleId: 'vehicle-1',
        idempotencyKey: 'vehicle:set-primary:vehicle-1',
      }),
    });
    expect(transportFixture.calls[1]).toMatchObject({
      method: 'POST',
      path: '/v1/vehicles/primary',
      body: expect.objectContaining({
        vehicleId: 'vehicle-2',
        idempotencyKey: 'vehicle:set-active:vehicle-2',
      }),
    });
  });

  test('typed errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/vehicles', error: new TimeoutError({ repository: 'vehicle', method: 'getVehicles', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/vehicles', error: new OfflineError({ repository: 'vehicle', method: 'addVehicle', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'PATCH', path: '/v1/vehicles/vehicle-1', error: new ServerError({ repository: 'vehicle', method: 'updateVehicle', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemoteVehicleRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemoteVehicleRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemoteVehicleRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.getVehicles()).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.addVehicle(baseVehicle)).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.updateVehicle({ ...baseVehicle, plateNumber: 'RAB 999Z' })).rejects.toBeInstanceOf(ServerError);
  });

  test('without a transport the repository fails closed', async () => {
    const repo = new RemoteVehicleRepository();
    await expect(repo.getVehicles()).rejects.toMatchObject({ code: 'backend_unavailable', repository: 'vehicle' });
  });
});

describe('vehicle shadow remote repository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('returns local results even when remote fails', async () => {
    const localRepository: VehicleRepository & { getVehicle?: (vehicleId: string) => Promise<DriverVehicleProfile | null> } = {
      getVehicles: jest.fn(async () => [baseVehicle]),
      setActiveVehicle: jest.fn(async () => undefined),
      setPrimaryVehicle: jest.fn(async () => undefined),
      addVehicle: jest.fn(async () => undefined),
      updateVehicle: jest.fn(async () => undefined),
      deleteVehicle: jest.fn(async () => undefined),
      getVehicle: jest.fn(async (vehicleId: string) => (vehicleId === baseVehicle.id ? baseVehicle : null)),
    };
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/vehicles', error: new TimeoutError({ repository: 'vehicle', method: 'getVehicles', transport: 'remote' }) },
      { method: 'GET', path: '/v1/vehicles/vehicle-1', error: new TimeoutError({ repository: 'vehicle', method: 'getVehicle', transport: 'remote' }) },
      { method: 'POST', path: '/v1/vehicles', error: new TimeoutError({ repository: 'vehicle', method: 'addVehicle', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/vehicles/vehicle-1', error: new TimeoutError({ repository: 'vehicle', method: 'updateVehicle', transport: 'remote' }) },
      { method: 'DELETE', path: '/v1/vehicles/vehicle-1', error: new TimeoutError({ repository: 'vehicle', method: 'deleteVehicle', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/vehicles/primary', error: new TimeoutError({ repository: 'vehicle', method: 'setPrimaryVehicle', transport: 'remote' }) },
      { method: 'POST', path: '/v1/vehicles/primary', error: new TimeoutError({ repository: 'vehicle', method: 'setActiveVehicle', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createVehicleShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getVehicles()).resolves.toEqual([baseVehicle]);
    await expect(shadowRepository.getVehicle(baseVehicle.id)).resolves.toEqual(baseVehicle);
    await expect(shadowRepository.addVehicle(baseVehicle)).resolves.toBeUndefined();
    await expect(shadowRepository.updateVehicle({ ...baseVehicle, plateNumber: 'RAB 999Z' })).resolves.toBeUndefined();
    await expect(shadowRepository.deleteVehicle(baseVehicle.id)).resolves.toBeUndefined();
    await expect(shadowRepository.setPrimaryVehicle(baseVehicle.id)).resolves.toBeUndefined();
    await expect(shadowRepository.setActiveVehicle(baseVehicle.id)).resolves.toBeUndefined();

    expect(localRepository.getVehicles).toHaveBeenCalled();
    expect(localRepository.getVehicle).toHaveBeenCalledWith(baseVehicle.id);
    expect(localRepository.addVehicle).toHaveBeenCalled();
    expect(localRepository.updateVehicle).toHaveBeenCalled();
    expect(localRepository.deleteVehicle).toHaveBeenCalledWith(baseVehicle.id);
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository: VehicleRepository & { getVehicle?: (vehicleId: string) => Promise<DriverVehicleProfile | null> } = {
      getVehicles: jest.fn(async () => [baseVehicle]),
      setActiveVehicle: jest.fn(async () => undefined),
      setPrimaryVehicle: jest.fn(async () => undefined),
      addVehicle: jest.fn(async () => undefined),
      updateVehicle: jest.fn(async () => undefined),
      deleteVehicle: jest.fn(async () => undefined),
      getVehicle: jest.fn(async (vehicleId: string) => (vehicleId === baseVehicle.id ? baseVehicle : null)),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/vehicles',
        response: {
          status: 200,
          data: {
            data: {
              vehicles: [toVehicleDto(baseVehicle), toVehicleDto(secondaryVehicle)],
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/vehicles/vehicle-1',
        response: {
          status: 200,
          data: {
            data: toVehicleDto({ ...baseVehicle, plateNumber: 'RAB 000Z', status: 'rejected' }, { isPrimary: true }),
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createVehicleShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getVehicles()).resolves.toEqual([baseVehicle]);
    await expect(shadowRepository.getVehicle(baseVehicle.id)).resolves.toEqual(baseVehicle);

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'vehicle.remote.shadow',
      'vehicle.remote.latency_ms',
      'vehicle.remote.shape_mismatch',
      'vehicle.remote.semantic_mismatch',
    ]));
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });

  test('vehicle verification remains backend future truth and does not change local vehicle ownership', async () => {
    const localVehicles = [baseVehicle];
    const localRepository: VehicleRepository & { getVehicle?: (vehicleId: string) => Promise<DriverVehicleProfile | null> } = {
      getVehicles: jest.fn(async () => localVehicles),
      setActiveVehicle: jest.fn(async () => undefined),
      setPrimaryVehicle: jest.fn(async () => undefined),
      addVehicle: jest.fn(async () => undefined),
      updateVehicle: jest.fn(async () => undefined),
      deleteVehicle: jest.fn(async () => undefined),
      getVehicle: jest.fn(async (vehicleId: string) => (vehicleId === baseVehicle.id ? baseVehicle : null)),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/vehicles',
        response: {
          status: 200,
          data: {
            data: {
              vehicles: [toVehicleDto({ ...baseVehicle, status: 'rejected' }, { isPrimary: true })],
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteVehicleRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createVehicleShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getVehicles()).resolves.toEqual(localVehicles);
    expect(localVehicles[0].status).toBe('approved');
  });
});
