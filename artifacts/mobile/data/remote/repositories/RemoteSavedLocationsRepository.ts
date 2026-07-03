import type { SavedLocationsRepository } from '@/data/repositories/interfaces';
import type { SavedLocation, RideLocation } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { createBackendUnavailableError, BackendError } from '../contracts/backendErrors';
import type { StagingShadowHealthEvent } from '../staging/health';
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

export interface SavedLocationsShadowRepositoryOptions {
  localRepository: SavedLocationsRepository;
  remoteRepository: RemoteSavedLocationsRepository;
  shadowWritesEnabled?: boolean;
  healthRecorder?: (event: StagingShadowHealthEvent) => void;
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

function emitSavedLocationsShadowEvent(
  event: 'local_completed' | 'staging_attempted' | 'staging_success' | 'staging_failure' | 'staging_timeout' | 'semantic_mismatch' | 'write_shadow_skipped',
  context: {
    method: string;
    latencyMs?: number;
    count?: number;
    statusClass?: string;
    mismatchCategory?: string;
    correlationId?: string;
    error?: unknown;
  },
) {
  observability.metrics.counter('saved_locations.staging_shadow', 1, {
    method: context.method,
    event,
    statusClass: context.statusClass ?? 'none',
    mismatchCategory: context.mismatchCategory ?? 'none',
  });
  if (typeof context.latencyMs === 'number') {
    observability.metrics.histogram('saved_locations.staging_shadow.latency_ms', context.latencyMs, {
      method: context.method,
      event,
    });
  }
  observability.logger.info('SavedLocationsStagingShadow', {
    event,
    method: context.method,
    latencyMs: context.latencyMs,
    count: context.count,
    statusClass: context.statusClass,
    mismatchCategory: context.mismatchCategory,
    correlationId: context.correlationId,
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

function classifySavedLocationsParity(local: SavedLocation[], remote: SavedLocation[]) {
  if (local.length !== remote.length) return 'count';
  const normalizeLabel = (value: string) => value.trim().toLowerCase();
  const localLabels = local.map(item => normalizeLabel(item.label)).sort();
  const remoteLabels = remote.map(item => normalizeLabel(item.label)).sort();
  if (localLabels.some((label, index) => label !== remoteLabels[index])) return 'label';
  return null;
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
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
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
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
      });
      return dtoToDomainSavedLocations(response.data.data);
    });
  }

  async delete(id: string, metadata: DeleteSavedLocationRequestDto): Promise<void> {
    await this.shadow('delete', async () => {
      if (!this.client) throw createBackendUnavailableError('savedLocations', 'delete', 'remote');
      const response = await this.client.delete<DeleteSavedLocationResponseDto>(`/v1/saved-locations/${id}`, {
        body: normalizeDeleteRequest(id, metadata),
        headers: {
          'X-Correlation-Id': metadata.correlationId,
          'X-Idempotency-Key': metadata.idempotencyKey,
        },
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
  shadowWritesEnabled?: boolean;
  healthRecorder?: (event: StagingShadowHealthEvent) => void;
}) {
  const { localRepository, remoteRepository, shadowWritesEnabled = true, healthRecorder } = options;

  function recordHealth(event: StagingShadowHealthEvent) {
    healthRecorder?.(event);
  }

  function withDomain(event: StagingShadowHealthEvent['event'], operation: string, extras: Partial<StagingShadowHealthEvent> = {}) {
    recordHealth({
      domain: 'savedLocations',
      operation,
      event,
      ...extras,
    });
  }

  return {
    async listSavedLocations() {
      const localStartedAt = Date.now();
      const local = await localRepository.listSavedLocations();
      withDomain('local_operation_completed', 'listSavedLocations', {
        latencyMs: Date.now() - localStartedAt,
      });
      emitSavedLocationsShadowEvent('local_completed', {
        method: 'listSavedLocations',
        latencyMs: Date.now() - localStartedAt,
        count: local.length,
      });
      const remoteStartedAt = Date.now();
      withDomain('shadow_attempted', 'listSavedLocations');
      emitSavedLocationsShadowEvent('staging_attempted', {
        method: 'listSavedLocations',
        count: local.length,
      });
      try {
        const remote = await remoteRepository.list();
        withDomain('shadow_success', 'listSavedLocations', {
          latencyMs: Date.now() - remoteStartedAt,
        });
        emitSavedLocationsShadowEvent('staging_success', {
          method: 'listSavedLocations',
          latencyMs: Date.now() - remoteStartedAt,
          count: remote.length,
        });
        const mismatchCategory = classifySavedLocationsParity(local, remote);
        if (mismatchCategory) {
          withDomain('semantic_mismatch', 'listSavedLocations', {
            mismatchCategory,
          });
          observability.logger.warn('SavedLocationsRemoteShadowMismatch', {
            method: 'listSavedLocations',
            localShape: summarizeShape(local),
            remoteShape: summarizeShape(remote),
            mismatchCategory,
          });
          observability.metrics.counter('saved_locations.remote.shape_mismatch', 1, {
            method: 'listSavedLocations',
            mismatchCategory,
          });
          emitSavedLocationsShadowEvent('semantic_mismatch', {
            method: 'listSavedLocations',
            mismatchCategory,
          });
        }
      } catch (error) {
        withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', 'listSavedLocations', {
          latencyMs: Date.now() - remoteStartedAt,
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        emitSavedLocationsShadowEvent(error instanceof Error && error.name === 'TimeoutError' ? 'staging_timeout' : 'staging_failure', {
          method: 'listSavedLocations',
          latencyMs: Date.now() - remoteStartedAt,
          error,
        });
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'listSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async replaceSavedLocations(next: SavedLocation[]) {
      await localRepository.replaceSavedLocations(next);
      withDomain('local_operation_completed', 'replaceSavedLocations', {
        count: next.length,
      });
      if (!shadowWritesEnabled) {
        withDomain('skipped_write_shadow_disabled', 'replaceSavedLocations');
        emitSavedLocationsShadowEvent('write_shadow_skipped', {
          method: 'replaceSavedLocations',
          count: next.length,
        });
        return;
      }
      withDomain('shadow_attempted', 'replaceSavedLocations');
      try {
        await remoteRepository.replaceSavedLocations(next);
        withDomain('shadow_success', 'replaceSavedLocations');
      } catch (error) {
        withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', 'replaceSavedLocations', {
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'replaceSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async saveLocation(location: RideLocation, label: string) {
      const local = await localRepository.saveLocation(location, label);
      withDomain('local_operation_completed', 'saveLocation');
      if (!shadowWritesEnabled) {
        withDomain('skipped_write_shadow_disabled', 'saveLocation');
        emitSavedLocationsShadowEvent('write_shadow_skipped', {
          method: 'saveLocation',
        });
        return local;
      }
      withDomain('shadow_attempted', 'saveLocation');
      try {
        await remoteRepository.saveLocation(location, label);
        withDomain('shadow_success', 'saveLocation');
      } catch (error) {
        withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', 'saveLocation', {
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'saveLocation',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async removeSavedLocation(id: string) {
      await localRepository.removeSavedLocation(id);
      withDomain('local_operation_completed', 'removeSavedLocation');
      if (!shadowWritesEnabled) {
        withDomain('skipped_write_shadow_disabled', 'removeSavedLocation');
        emitSavedLocationsShadowEvent('write_shadow_skipped', {
          method: 'removeSavedLocation',
        });
        return;
      }
      withDomain('shadow_attempted', 'removeSavedLocation');
      try {
        await remoteRepository.removeSavedLocation(id);
        withDomain('shadow_success', 'removeSavedLocation');
      } catch (error) {
        withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', 'removeSavedLocation', {
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'removeSavedLocation',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async clearSavedLocations() {
      await localRepository.clearSavedLocations();
      withDomain('local_operation_completed', 'clearSavedLocations');
      if (!shadowWritesEnabled) {
        withDomain('skipped_write_shadow_disabled', 'clearSavedLocations');
        emitSavedLocationsShadowEvent('write_shadow_skipped', {
          method: 'clearSavedLocations',
        });
        return;
      }
      withDomain('shadow_attempted', 'clearSavedLocations');
      try {
        await remoteRepository.clearSavedLocations();
        withDomain('shadow_success', 'clearSavedLocations');
      } catch (error) {
        withDomain(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'shadow_failure', 'clearSavedLocations', {
          errorCategory: error instanceof Error ? error.name : 'unknown',
        });
        observability.logger.warn('SavedLocationsRemoteShadowFailure', {
          method: 'clearSavedLocations',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
  } satisfies SavedLocationsRepository;
}
