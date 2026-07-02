import type { SavedLocationsRepository } from '@/data/repositories/interfaces';
import type { SavedLocation, RideLocation } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { createBackendUnavailableError, BackendError } from '../contracts/backendErrors';
import type {
  CreateSavedLocationRequestDto,
  CreateSavedLocationResponseDto,
  DeleteSavedLocationResponseDto,
  ListSavedLocationsResponseDto,
  SavedLocationDto,
  DeleteSavedLocationRequestDto,
  UpdateSavedLocationRequestDto,
  UpdateSavedLocationResponseDto,
} from '../contracts/api';
import {
  dtoListToDomainSavedLocations,
  dtoToDomainSavedLocations,
  domainToCreateSavedLocationDto,
  domainToUpdateSavedLocationDto,
  errorToRepositoryFailureSavedLocations,
} from '../mappers/savedLocationsMapper';

export interface RemoteSavedLocationsRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function recordSavedLocationsTelemetry(
  event: 'saved locations remote shadow request' | 'saved locations remote shadow success' | 'saved locations remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('saved_locations.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('saved_locations.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('SavedLocationsRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function toBackendUnavailable(method: string, error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  return createBackendUnavailableError('savedLocations', method, 'remote');
}

function normalizeCreateRequest(
  location: RideLocation,
  label: string,
  metadata: CreateSavedLocationRequestDto,
): CreateSavedLocationRequestDto {
  return domainToCreateSavedLocationDto(
    {
      address: location.address ?? '',
      latitude: location.latitude,
      longitude: location.longitude,
    },
    label,
    metadata,
  );
}

function normalizeUpdateRequest(
  location: SavedLocation,
  metadata: UpdateSavedLocationRequestDto,
): UpdateSavedLocationRequestDto {
  return domainToUpdateSavedLocationDto(location, metadata);
}

function normalizeDeleteRequest(
  id: string,
  metadata: DeleteSavedLocationRequestDto,
): DeleteSavedLocationRequestDto {
  return {
    ...metadata,
    id,
  };
}

export class RemoteSavedLocationsRepository implements SavedLocationsRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteSavedLocationsRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordSavedLocationsTelemetry('saved locations remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordSavedLocationsTelemetry('saved locations remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordSavedLocationsTelemetry('saved locations remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toBackendUnavailable(method, error);
    }
  }

  async list(): Promise<SavedLocation[]> {
    return this.shadow('list', async () => {
      if (!this.client) throw createBackendUnavailableError('savedLocations', 'list', 'remote');
      const response = await this.client.get<ListSavedLocationsResponseDto>('/v1/saved-locations');
      const items = response.data?.data?.items ?? [];
      return dtoListToDomainSavedLocations(items);
    });
  }

  async create(location: RideLocation, label: string, metadata: CreateSavedLocationRequestDto): Promise<SavedLocation> {
    return this.shadow('create', async () => {
      if (!this.client) throw createBackendUnavailableError('savedLocations', 'create', 'remote');
      const request = normalizeCreateRequest(location, label, metadata);
      const response = await this.client.post<CreateSavedLocationResponseDto>('/v1/saved-locations', {
        body: request,
      });
      return dtoToDomainSavedLocations(response.data.data);
    });
  }

  async update(location: SavedLocation, metadata: UpdateSavedLocationRequestDto): Promise<SavedLocation> {
    return this.shadow('update', async () => {
      if (!this.client) throw createBackendUnavailableError('savedLocations', 'update', 'remote');
      const request = normalizeUpdateRequest(location, metadata);
      const response = await this.client.patch<UpdateSavedLocationResponseDto>(`/v1/saved-locations/${location.id}`, {
        body: request,
      });
      return dtoToDomainSavedLocations(response.data.data);
    });
  }

  async delete(id: string, metadata: DeleteSavedLocationRequestDto): Promise<void> {
    await this.shadow('delete', async () => {
      if (!this.client) throw createBackendUnavailableError('savedLocations', 'delete', 'remote');
      const response = await this.client.delete<DeleteSavedLocationResponseDto>(`/v1/saved-locations/${id}`, {
        body: normalizeDeleteRequest(id, metadata),
      });
      if (!response.data?.data?.deleted) {
        throw createBackendUnavailableError('savedLocations', 'delete', 'remote');
      }
      return undefined;
    });
  }

  async listSavedLocations(): Promise<SavedLocation[]> {
    return this.list();
  }

  async replaceSavedLocations(next: SavedLocation[]): Promise<void> {
    const current = await this.list().catch(() => []);
    const currentById = new Map(current.map(item => [item.id, item]));
    const nextById = new Map(next.map(item => [item.id, item]));

    for (const item of current) {
      if (!nextById.has(item.id)) {
        await this.delete(item.id, {
          idempotencyKey: `savedLocations:delete:${item.id}`,
          correlationId: `savedLocations:replace:${item.id}`,
          actorId: item.id,
          actorRole: 'customer',
          clientTimestamp: new Date().toISOString(),
          id: item.id,
        });
      }
    }

    for (const item of next) {
      if (!currentById.has(item.id)) {
        await this.create(
          {
            address: item.address ?? '',
            latitude: item.latitude,
            longitude: item.longitude,
          },
          item.label,
          {
            idempotencyKey: `savedLocations:create:${item.id}`,
            correlationId: `savedLocations:replace:${item.id}`,
            actorId: item.id,
            actorRole: 'customer',
            clientTimestamp: new Date().toISOString(),
            label: item.label,
            address: item.address ?? '',
            latitude: item.latitude,
            longitude: item.longitude,
          },
        );
      } else {
        await this.update(item, {
          idempotencyKey: `savedLocations:update:${item.id}`,
          correlationId: `savedLocations:replace:${item.id}`,
          actorId: item.id,
          actorRole: 'customer',
          clientTimestamp: new Date().toISOString(),
          id: item.id,
          label: item.label,
          address: item.address ?? '',
          latitude: item.latitude,
          longitude: item.longitude,
        });
      }
    }
  }

  async saveLocation(location: RideLocation, label: string): Promise<boolean> {
    const cleanLabel = label.trim();
    if (!cleanLabel) return false;
    const saved = await this.create(
      location,
      cleanLabel,
      {
        idempotencyKey: `savedLocations:save:${cleanLabel}:${location.latitude}:${location.longitude}`,
        correlationId: `savedLocations:save:${cleanLabel}`,
        actorId: cleanLabel,
        actorRole: 'customer',
        clientTimestamp: new Date().toISOString(),
        label: cleanLabel,
        address: location.address ?? '',
        latitude: location.latitude,
        longitude: location.longitude,
      },
    );
    return Boolean(saved);
  }

  async removeSavedLocation(id: string): Promise<void> {
    await this.delete(id, {
      idempotencyKey: `savedLocations:remove:${id}`,
      correlationId: `savedLocations:remove:${id}`,
      actorId: id,
      actorRole: 'customer',
      clientTimestamp: new Date().toISOString(),
      id,
    });
  }

  async clearSavedLocations(): Promise<void> {
    const current = await this.list().catch(() => []);
    for (const item of current) {
      await this.removeSavedLocation(item.id);
    }
  }
}

export function createRemoteSavedLocationsRepository(options: RemoteSavedLocationsRepositoryOptions = {}) {
  return new RemoteSavedLocationsRepository(options);
}

export function createSavedLocationsShadowRepository(options: {
  localRepository: SavedLocationsRepository;
  remoteRepository: RemoteSavedLocationsRepository;
}) {
  const { localRepository, remoteRepository } = options;

  return {
    async listSavedLocations() {
      const local = await localRepository.listSavedLocations();
      try {
        const remote = await remoteRepository.list();
        if (summarizeShape(remote) !== summarizeShape(local)) {
          observability.logger.warn('SavedLocationsRemoteShadowMismatch', {
            method: 'listSavedLocations',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
          });
          observability.metrics.counter('saved_locations.remote.shape_mismatch', 1, {
            method: 'listSavedLocations',
          });
        }
      } catch (error) {
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'listSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async replaceSavedLocations(next: SavedLocation[]) {
      await localRepository.replaceSavedLocations(next);
      try {
        await remoteRepository.replaceSavedLocations(next);
      } catch (error) {
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'replaceSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async saveLocation(location: RideLocation, label: string) {
      const local = await localRepository.saveLocation(location, label);
      try {
        await remoteRepository.saveLocation(location, label);
      } catch (error) {
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'saveLocation',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async removeSavedLocation(id: string) {
      await localRepository.removeSavedLocation(id);
      try {
        await remoteRepository.removeSavedLocation(id);
      } catch (error) {
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'removeSavedLocation',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async clearSavedLocations() {
      await localRepository.clearSavedLocations();
      try {
        await remoteRepository.clearSavedLocations();
      } catch (error) {
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'clearSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
  } satisfies SavedLocationsRepository;
}
