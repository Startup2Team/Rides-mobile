import type { VehicleRepository } from '@/data/repositories/interfaces';
import type { DriverProfile, DriverVehicleProfile } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { BackendError, createBackendUnavailableError } from '../contracts/backendErrors';
import type {
  AddVehicleRequestDto,
  AddVehicleResponseDto,
  DeleteVehicleRequestDto,
  DeleteVehicleResponseDto,
  GetVehicleResponseDto,
  ListVehiclesResponseDto,
  SetPrimaryVehicleRequestDto,
  SetPrimaryVehicleResponseDto,
  UpdateVehicleRequestDto,
  UpdateVehicleResponseDto,
} from '../contracts/api';
import {
  dtoListToDomainVehicles,
  dtoToDomainVehicle,
  dtoToDomainVehicleDetail,
  domainToAddVehicleDto,
  domainToSetPrimaryVehicleDto,
  domainToUpdateVehicleDto,
  errorToRepositoryFailureVehicle,
} from '../mappers/vehicleMapper';

export interface RemoteVehicleRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function summarizeVehicle(vehicle: DriverVehicleProfile | null | undefined) {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    vehicleType: vehicle.vehicleType,
    status: vehicle.status,
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
  };
}

function summarizeVehicleList(vehicles: DriverProfile['vehicles']) {
  return (vehicles ?? []).map(vehicle => summarizeVehicle(vehicle)).filter((vehicle): vehicle is NonNullable<ReturnType<typeof summarizeVehicle>> => vehicle !== null);
}

function normalizeVehicleCollection(vehicles: DriverProfile['vehicles']) {
  return vehicles ?? [];
}

function hasSemanticMismatch(local: unknown, remote: unknown) {
  return JSON.stringify(local ?? null) !== JSON.stringify(remote ?? null);
}

function recordTelemetry(
  event: 'vehicle remote shadow request' | 'vehicle remote shadow success' | 'vehicle remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('vehicle.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('vehicle.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('VehicleRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('vehicle.remote.shape_mismatch', 1, { method });
  }
  observability.metrics.counter('vehicle.remote.semantic_mismatch', 1, { method });
  observability.logger.warn('VehicleRemoteShadowMismatch', {
    method,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function toRepositoryFailure(method: string, error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  return errorToRepositoryFailureVehicle(error);
}

function createVehicleMetadata(action: string, subjectId: string | null) {
  const timestamp = new Date().toISOString();
  return {
    idempotencyKey: `vehicle:${action}:${subjectId ?? 'none'}`,
    correlationId: `vehicle:${action}:${subjectId ?? 'none'}`,
    actorId: subjectId ?? 'vehicle-system',
    actorRole: 'driver' as const,
    clientTimestamp: timestamp,
  };
}

export class RemoteVehicleRepository implements VehicleRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteVehicleRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('vehicle remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('vehicle remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('vehicle remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(method, error);
    }
  }

  async listVehicles(): Promise<DriverVehicleProfile[]> {
    return this.getVehicles().then(vehicles => vehicles ?? []);
  }

  async getVehicles(): Promise<DriverProfile['vehicles']> {
    return this.shadow('getVehicles', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'getVehicles', 'remote');
      const response = await this.client.get<ListVehiclesResponseDto>('/v1/vehicles');
      return dtoListToDomainVehicles(response.data.data.vehicles ?? []);
    });
  }

  async getVehicle(vehicleId: string): Promise<DriverVehicleProfile | null> {
    return this.shadow('getVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'getVehicle', 'remote');
      const response = await this.client.get<GetVehicleResponseDto>(`/v1/vehicles/${vehicleId}`);
      return dtoToDomainVehicleDetail(response.data.data);
    });
  }

  async setActiveVehicle(vehicleId: string | null): Promise<void> {
    await this.shadow('setActiveVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'setActiveVehicle', 'remote');
      const request: SetPrimaryVehicleRequestDto = domainToSetPrimaryVehicleDto(vehicleId, createVehicleMetadata('set-active', vehicleId));
      const response = await this.client.post<SetPrimaryVehicleResponseDto>('/v1/vehicles/primary', {
        body: request,
      });
      if (response.data?.data?.primaryVehicleId !== vehicleId) {
        observability.metrics.counter('vehicle.remote.semantic_mismatch', 1, { method: 'setActiveVehicle' });
      }
    });
  }

  async setPrimaryVehicle(vehicleId: string | null): Promise<void> {
    await this.shadow('setPrimaryVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'setPrimaryVehicle', 'remote');
      const request: SetPrimaryVehicleRequestDto = domainToSetPrimaryVehicleDto(vehicleId, createVehicleMetadata('set-primary', vehicleId));
      const response = await this.client.patch<SetPrimaryVehicleResponseDto>('/v1/vehicles/primary', {
        body: request,
      });
      if (response.data?.data?.primaryVehicleId !== vehicleId) {
        observability.metrics.counter('vehicle.remote.semantic_mismatch', 1, { method: 'setPrimaryVehicle' });
      }
    });
  }

  async addVehicle(vehicle: DriverVehicleProfile): Promise<void> {
    await this.shadow('addVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'addVehicle', 'remote');
      const request: AddVehicleRequestDto = domainToAddVehicleDto(vehicle, createVehicleMetadata('add', vehicle.id));
      const response = await this.client.post<AddVehicleResponseDto>('/v1/vehicles', {
        body: request,
      });
      const mapped = dtoToDomainVehicle(response.data.data);
      void mapped;
    });
  }

  async updateVehicle(vehicle: DriverVehicleProfile): Promise<void> {
    await this.shadow('updateVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'updateVehicle', 'remote');
      const metadata = {
        ...createVehicleMetadata('update', vehicle.id),
        vehicleId: vehicle.id,
      };
      const request: UpdateVehicleRequestDto = domainToUpdateVehicleDto(vehicle, metadata);
      const response = await this.client.patch<UpdateVehicleResponseDto>(`/v1/vehicles/${vehicle.id}`, {
        body: request,
      });
      const mapped = dtoToDomainVehicle(response.data.data);
      void mapped;
    });
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    await this.shadow('deleteVehicle', async () => {
      if (!this.client) throw createBackendUnavailableError('vehicle', 'deleteVehicle', 'remote');
      const request: DeleteVehicleRequestDto = {
        ...createVehicleMetadata('delete', vehicleId),
        vehicleId,
      };
      const response = await this.client.delete<DeleteVehicleResponseDto>(`/v1/vehicles/${vehicleId}`, {
        body: request,
      });
      if (!response.data?.data?.deleted) {
        throw createBackendUnavailableError('vehicle', 'deleteVehicle', 'remote');
      }
    });
  }
}

export function createRemoteVehicleRepositoryPrototype(options: RemoteVehicleRepositoryOptions = {}) {
  return new RemoteVehicleRepository(options);
}

export function createVehicleShadowRepository(options: {
  localRepository: VehicleRepository & {
    getVehicle?: (vehicleId: string) => Promise<DriverVehicleProfile | null>;
  };
  remoteRepository: RemoteVehicleRepository | (VehicleRepository & {
    listVehicles?: () => Promise<DriverVehicleProfile[]>;
    getVehicle?: (vehicleId: string) => Promise<DriverVehicleProfile | null>;
  });
}) {
  const { localRepository, remoteRepository } = options;

  return {
    async getVehicles() {
      const local = await localRepository.getVehicles();
      try {
        const remote = await remoteRepository.getVehicles();
        const normalizedLocal = normalizeVehicleCollection(local);
        const normalizedRemote = normalizeVehicleCollection(remote);
        if (summarizeShape(normalizedLocal) !== summarizeShape(normalizedRemote) || hasSemanticMismatch(summarizeVehicleList(normalizedLocal), summarizeVehicleList(normalizedRemote))) {
          recordMismatch('getVehicles', normalizedLocal, normalizedRemote);
        }
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'getVehicles',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async listVehicles() {
      const local = await localRepository.getVehicles();
      return local ?? [];
    },
    async getVehicle(vehicleId: string) {
      const local = localRepository.getVehicle
        ? await localRepository.getVehicle(vehicleId)
        : (await localRepository.getVehicles())?.find(vehicle => vehicle.id === vehicleId) ?? null;
      try {
        const remote = remoteRepository.getVehicle
          ? await remoteRepository.getVehicle(vehicleId)
          : (await remoteRepository.getVehicles())?.find(vehicle => vehicle.id === vehicleId) ?? null;
        if (summarizeShape(local) !== summarizeShape(remote) || hasSemanticMismatch(summarizeVehicle(local), summarizeVehicle(remote))) {
          recordMismatch('getVehicle', local, remote);
        }
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'getVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async setActiveVehicle(vehicleId: string | null) {
      await localRepository.setActiveVehicle(vehicleId);
      try {
        await remoteRepository.setActiveVehicle(vehicleId);
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'setActiveVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async setPrimaryVehicle(vehicleId: string | null) {
      await localRepository.setPrimaryVehicle(vehicleId);
      try {
        await remoteRepository.setPrimaryVehicle(vehicleId);
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'setPrimaryVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async addVehicle(vehicle: DriverVehicleProfile) {
      await localRepository.addVehicle(vehicle);
      try {
        await remoteRepository.addVehicle(vehicle);
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'addVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async updateVehicle(vehicle: DriverVehicleProfile) {
      await localRepository.updateVehicle(vehicle);
      try {
        await remoteRepository.updateVehicle(vehicle);
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'updateVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async deleteVehicle(vehicleId: string) {
      await localRepository.deleteVehicle(vehicleId);
      try {
        await remoteRepository.deleteVehicle(vehicleId);
      } catch (error) {
        observability.logger.warn('VehicleRemoteShadowFailure', {
          method: 'deleteVehicle',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
  } satisfies VehicleRepository & {
    listVehicles(): Promise<DriverVehicleProfile[]>;
    getVehicle(vehicleId: string): Promise<DriverVehicleProfile | null>;
  };
}
