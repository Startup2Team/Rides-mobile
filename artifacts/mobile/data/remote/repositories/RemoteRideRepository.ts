import type { RideRepository } from '@/data/repositories/interfaces';
import { rideRepository as localRideRepository } from '@/data/repositories';
import type { Ride } from '@/types';
import type { ActiveRideReadModel } from '@/domains/ride/readModels';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import type { ActiveRideResponseDto, RideDetailResponseDto, RideHistoryResponseDto } from '../contracts/api';
import { BackendError, createBackendUnavailableError, createNotImplementedError } from '../contracts/backendErrors';
import {
  dtoListToDomainRideHistory,
  dtoToDomainActiveRide,
  dtoToDomainRide,
  errorToRepositoryFailureRide,
} from '../mappers/rideMapper';

export interface RemoteRideRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface RideReadOnlyRepository extends RideRepository {
  getActiveRide(): Promise<ActiveRideReadModel | null>;
  getRideHistory(): Promise<Ride[]>;
  getRideDetail(rideId: string): Promise<Ride | null>;
}

type RideReadOnlyLocalRepository =
  Pick<RideRepository, 'loadRideHistory' | 'getRideDetail'>
  & Partial<Pick<RideReadOnlyRepository, 'getActiveRide'>>;

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function summarizeRide(ride: Ride | null | undefined) {
  if (!ride) return null;
  return {
    id: ride.id,
    status: ride.status,
    customerId: ride.customerId,
    driverId: ride.driverId ?? null,
    vehicleType: ride.vehicleType,
    pickup: ride.pickup.address ?? null,
    destination: ride.destination.address ?? null,
    suggestedFare: ride.suggestedFare,
    agreedFare: ride.agreedFare ?? null,
    createdAt: ride.createdAt,
    completedAt: ride.completedAt ?? null,
  };
}

function summarizeActiveRide(ride: ActiveRideReadModel | null | undefined) {
  if (!ride) return null;
  return {
    rideId: ride.rideId,
    status: ride.status,
    phase: ride.phase,
    customerId: ride.customer.userId,
    driverId: ride.driver?.userId ?? null,
    updatedAt: ride.updatedAt,
    sequenceNumber: ride.sequenceNumber,
  };
}

function recordTelemetry(
  event: 'ride remote shadow request' | 'ride remote shadow success' | 'ride remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('ride.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('ride.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('RideRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown, detail: string) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('ride.remote.shape_mismatch', 1, { method, detail });
  }
  observability.metrics.counter('ride.remote.semantic_mismatch', 1, { method, detail });
  observability.logger.warn('RideRemoteShadowMismatch', {
    method,
    detail,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('ride', method, 'remote');
  return client;
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailureRide(error);
}

export class RemoteRideRepository implements RideReadOnlyRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteRideRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('ride remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('ride remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('ride remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async getActiveRide(): Promise<ActiveRideReadModel | null> {
    return this.shadow('getActiveRide', async () => {
      const client = resolveClient('getActiveRide', this.client);
      const response = await client.get<ActiveRideResponseDto>('/v1/rides/active');
      return dtoToDomainActiveRide(response.data.data);
    });
  }

  async getRideHistory(): Promise<Ride[]> {
    return this.shadow('getRideHistory', async () => {
      const client = resolveClient('getRideHistory', this.client);
      const response = await client.get<RideHistoryResponseDto>('/v1/rides/history');
      return dtoListToDomainRideHistory(response.data?.data?.items ?? []);
    });
  }

  async loadRideHistory(): Promise<Ride[] | null> {
    return this.getRideHistory();
  }

  async getRideDetail(rideId: string): Promise<Ride | null> {
    return this.shadow('getRideDetail', async () => {
      const client = resolveClient('getRideDetail', this.client);
      const response = await client.get<RideDetailResponseDto>(`/v1/rides/${rideId}`);
      return dtoToDomainRide(response.data.data);
    });
  }

  async appendRideHistory(_completed?: Ride): Promise<void> {
    throw createNotImplementedError('ride', 'appendRideHistory', this.transportLabel);
  }

  async clearRideHistory(): Promise<void> {
    throw createNotImplementedError('ride', 'clearRideHistory', this.transportLabel);
  }

  async requestRide(): Promise<never> {
    throw createNotImplementedError('ride', 'requestRide', this.transportLabel);
  }

  async cancelRide(): Promise<never> {
    throw createNotImplementedError('ride', 'cancelRide', this.transportLabel);
  }

  async acceptRide(): Promise<never> {
    throw createNotImplementedError('ride', 'acceptRide', this.transportLabel);
  }

  async declineRide(): Promise<never> {
    throw createNotImplementedError('ride', 'declineRide', this.transportLabel);
  }

  async startRide(): Promise<never> {
    throw createNotImplementedError('ride', 'startRide', this.transportLabel);
  }

  async completeRide(): Promise<never> {
    throw createNotImplementedError('ride', 'completeRide', this.transportLabel);
  }
}

export function createRemoteRideRepositoryPrototype(options: RemoteRideRepositoryOptions = {}) {
  return new RemoteRideRepository(options);
}

export function createRideReadOnlyShadowRepository(options: {
  localRepository?: RideReadOnlyLocalRepository;
  remoteRepository: RemoteRideRepository;
}): RideReadOnlyRepository {
  const localRepository: RideReadOnlyLocalRepository = options.localRepository ?? localRideRepository;
  const { remoteRepository } = options;

  async function compareAndReturn<T>(
    method: string,
    local: () => Promise<T>,
    remote: () => Promise<T>,
    compare: (localValue: T, remoteValue: T) => void,
  ): Promise<T> {
    const localValue = await local();
    try {
      const remoteValue = await remote();
      compare(localValue, remoteValue);
    } catch (error) {
      observability.logger.warn('RideRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  return {
    async getActiveRide() {
      return compareAndReturn(
        'getActiveRide',
        async () => localRepository.getActiveRide ? localRepository.getActiveRide() : null,
        () => remoteRepository.getActiveRide(),
        (localValue, remoteValue) => {
          const localShape = summarizeActiveRide(localValue);
          const remoteShape = summarizeActiveRide(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getActiveRide', localShape, remoteShape, 'active-ride');
          }
        },
      );
    },
    async getRideHistory() {
      return compareAndReturn(
        'getRideHistory',
        async () => (await localRepository.loadRideHistory()) ?? [],
        () => remoteRepository.getRideHistory(),
        (localValue, remoteValue) => {
          const localShape = localValue.map(summarizeRide);
          const remoteShape = remoteValue.map(summarizeRide);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getRideHistory', localShape, remoteShape, 'history');
          }
        },
      );
    },
    async loadRideHistory() {
      return this.getRideHistory();
    },
    async getRideDetail(rideId: string) {
      return compareAndReturn(
        'getRideDetail',
        () => localRepository.getRideDetail(rideId),
        () => remoteRepository.getRideDetail(rideId),
        (localValue, remoteValue) => {
          const localShape = summarizeRide(localValue);
          const remoteShape = summarizeRide(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getRideDetail', localShape, remoteShape, 'detail');
          }
        },
      );
    },
    async appendRideHistory(_completed?: Ride) {
      throw createNotImplementedError('ride', 'appendRideHistory', 'shadow_remote');
    },
    async clearRideHistory() {
      throw createNotImplementedError('ride', 'clearRideHistory', 'shadow_remote');
    },
  };
}
