import type { MapRepository } from '@/data/repositories/interfaces';
import { mapRepository as localMapRepository } from '@/data/repositories';
import type { RouteResult } from '@/services/mapbox';
import type { Coords, RideLocation, VehicleType } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import type {
  DistanceEstimateResponseDto,
  DurationEstimateResponseDto,
  FareEstimateResponseDto,
  ReverseGeocodeResponseDto,
  RouteEstimateResponseDto,
  RoutePreviewResponseDto,
} from '../contracts/api';
import { BackendError, createBackendUnavailableError } from '../contracts/backendErrors';
import {
  domainToFareEstimateDto,
  domainToReverseGeocodeDto,
  domainToRouteEstimateDto,
  domainToRoutePreviewDto,
  dtoToDomainDistanceEstimate,
  dtoToDomainDurationEstimate,
  dtoToDomainFareEstimatePreview,
  dtoToDomainReverseGeocodeMap,
  dtoToDomainRouteEstimate,
  dtoToDomainRoutePreview,
  errorToRepositoryFailureMap,
  type FareEstimatePreview,
  type RouteEstimateInput,
} from '../mappers/mapMapper';
import {
  compareFarePreview,
  compareLocation,
  compareRoute,
  defaultMapComparisonPolicy,
  type MapComparisonPolicy,
} from './searchMapComparisonPolicy';

export interface RemoteMapRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface MapPreviewRepository extends MapRepository {
  getRouteEstimate(input: RouteEstimateInput): Promise<RouteResult>;
  getRoutePreview(input: RouteEstimateInput): Promise<RouteResult>;
  getDistanceEstimate(input: RouteEstimateInput): Promise<number>;
  getDurationEstimate(input: RouteEstimateInput): Promise<number>;
  getFareEstimatePreview(input: RouteEstimateInput & { vehicleType: VehicleType | string; distanceMeters?: number | null; durationSeconds?: number | null }): Promise<FareEstimatePreview>;
}

type MapShadowLocalRepository = MapRepository & Partial<MapPreviewRepository>;

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function coordinateBucket(coords?: Coords | null) {
  if (!coords) return 'unknown';
  return `${coords.latitude.toFixed(1)},${coords.longitude.toFixed(1)}`;
}

function distanceBucket(distanceMeters?: number | null) {
  if (typeof distanceMeters !== 'number') return 'unknown';
  if (distanceMeters < 1_000) return 'under_1km';
  if (distanceMeters < 5_000) return '1_5km';
  if (distanceMeters < 10_000) return '5_10km';
  return 'over_10km';
}

function durationBucket(durationSeconds?: number | null) {
  if (typeof durationSeconds !== 'number') return 'unknown';
  if (durationSeconds < 300) return 'under_5m';
  if (durationSeconds < 900) return '5_15m';
  if (durationSeconds < 1_800) return '15_30m';
  return 'over_30m';
}

function recordTelemetry(
  event: 'map remote shadow request' | 'map remote shadow success' | 'map remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    origin?: Coords | null;
    destination?: Coords | null;
    distanceMeters?: number | null;
    durationSeconds?: number | null;
    error?: unknown;
  },
) {
  observability.metrics.counter('map.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('map.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('MapRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    originBucket: coordinateBucket(context.origin),
    destinationBucket: coordinateBucket(context.destination),
    distanceBucket: distanceBucket(context.distanceMeters),
    durationBucket: durationBucket(context.durationSeconds),
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, category: string, metadata: Record<string, unknown>) {
  observability.metrics.counter('map.remote.semantic_mismatch', 1, { method, category });
  observability.metrics.counter(`map.remote.${category}_mismatch`, 1, { method });
  observability.logger.warn('MapRemoteShadowMismatch', {
    method,
    category,
    ...metadata,
  });
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('map', method, 'remote');
  return client;
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailureMap(error);
}

export class RemoteMapRepository implements MapPreviewRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteMapRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, input: RouteEstimateInput | { origin?: Coords; destination?: Coords } | null, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('map remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
      origin: input?.origin,
      destination: input?.destination,
    });
    try {
      const value = await execute();
      recordTelemetry('map remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
        origin: input?.origin,
        destination: input?.destination,
        distanceMeters: typeof value === 'object' && value && 'distanceMeters' in value ? Number((value as { distanceMeters: unknown }).distanceMeters) : undefined,
        durationSeconds: typeof value === 'object' && value && 'durationSeconds' in value ? Number((value as { durationSeconds: unknown }).durationSeconds) : undefined,
      });
      return value;
    } catch (error) {
      recordTelemetry('map remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        origin: input?.origin,
        destination: input?.destination,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async reverseGeocode(coords: Coords): Promise<RideLocation | null> {
    return this.shadow('reverseGeocode', { origin: coords }, async () => {
      const client = resolveClient('reverseGeocode', this.client);
      const response = await client.post<ReverseGeocodeResponseDto>('/v1/maps/reverse-geocode', {
        body: domainToReverseGeocodeDto(coords),
      });
      return dtoToDomainReverseGeocodeMap(response.data.data);
    });
  }

  async getRouteEstimate(input: RouteEstimateInput): Promise<RouteResult> {
    return this.shadow('getRouteEstimate', input, async () => {
      const client = resolveClient('getRouteEstimate', this.client);
      const response = await client.post<RouteEstimateResponseDto>('/v1/maps/route-estimate', {
        body: domainToRouteEstimateDto(input),
      });
      return dtoToDomainRouteEstimate(response.data.data);
    });
  }

  async getRoutePreview(input: RouteEstimateInput): Promise<RouteResult> {
    return this.shadow('getRoutePreview', input, async () => {
      const client = resolveClient('getRoutePreview', this.client);
      const response = await client.post<RoutePreviewResponseDto>('/v1/maps/route-preview', {
        body: domainToRoutePreviewDto(input),
      });
      return dtoToDomainRoutePreview(response.data.data);
    });
  }

  async getDistanceEstimate(input: RouteEstimateInput): Promise<number> {
    return this.shadow('getDistanceEstimate', input, async () => {
      const client = resolveClient('getDistanceEstimate', this.client);
      const response = await client.post<DistanceEstimateResponseDto>('/v1/maps/distance-estimate', {
        body: domainToRouteEstimateDto(input),
      });
      return dtoToDomainDistanceEstimate(response.data.data);
    });
  }

  async getDurationEstimate(input: RouteEstimateInput): Promise<number> {
    return this.shadow('getDurationEstimate', input, async () => {
      const client = resolveClient('getDurationEstimate', this.client);
      const response = await client.post<DurationEstimateResponseDto>('/v1/maps/duration-estimate', {
        body: domainToRouteEstimateDto(input),
      });
      return dtoToDomainDurationEstimate(response.data.data);
    });
  }

  async getFareEstimatePreview(input: RouteEstimateInput & { vehicleType: VehicleType | string; distanceMeters?: number | null; durationSeconds?: number | null }): Promise<FareEstimatePreview> {
    return this.shadow('getFareEstimatePreview', input, async () => {
      const client = resolveClient('getFareEstimatePreview', this.client);
      const response = await client.post<FareEstimateResponseDto>('/v1/maps/fare-estimate', {
        body: domainToFareEstimateDto(input),
      });
      return dtoToDomainFareEstimatePreview(response.data.data);
    });
  }
}

export function createRemoteMapRepositoryPrototype(options: RemoteMapRepositoryOptions = {}) {
  return new RemoteMapRepository(options);
}

export function createMapShadowRepository(options: {
  localRepository?: MapShadowLocalRepository;
  remoteRepository: RemoteMapRepository;
  enableRemoteDiagnostics?: boolean;
  comparisonPolicy?: Partial<MapComparisonPolicy>;
}): MapPreviewRepository {
  const localRepository: MapShadowLocalRepository = options.localRepository ?? localMapRepository;
  const { remoteRepository } = options;
  const enableRemoteDiagnostics = options.enableRemoteDiagnostics === true;
  const comparisonPolicy = { ...defaultMapComparisonPolicy, ...options.comparisonPolicy };

  async function runRemote<T>(method: string, remote: () => Promise<T>, compare?: (remoteValue: T) => void) {
    if (!enableRemoteDiagnostics) return;
    try {
      const remoteValue = await remote();
      compare?.(remoteValue);
    } catch (error) {
      observability.logger.warn('MapRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  return {
    async reverseGeocode(coords: Coords) {
      const local = await localRepository.reverseGeocode(coords);
      await runRemote('reverseGeocode', () => remoteRepository.reverseGeocode(coords), remote => {
        const comparison = compareLocation(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('reverseGeocode', comparison.category, comparison);
      });
      return local;
    },
    async getRouteEstimate(input: RouteEstimateInput) {
      const local = localRepository.getRouteEstimate
        ? await localRepository.getRouteEstimate(input)
        : await localRepository.getRoutePreview?.(input) ?? { coordinates: [], distanceMeters: 0, durationSeconds: 0 };
      await runRemote('getRouteEstimate', () => remoteRepository.getRouteEstimate(input), remote => {
        const comparison = compareRoute(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('getRouteEstimate', comparison.category, comparison);
      });
      return local;
    },
    async getRoutePreview(input: RouteEstimateInput) {
      const local = localRepository.getRoutePreview
        ? await localRepository.getRoutePreview(input)
        : await this.getRouteEstimate(input);
      await runRemote('getRoutePreview', () => remoteRepository.getRoutePreview(input), remote => {
        const comparison = compareRoute(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('getRoutePreview', comparison.category, comparison);
      });
      return local;
    },
    async getDistanceEstimate(input: RouteEstimateInput) {
      const local = localRepository.getDistanceEstimate
        ? await localRepository.getDistanceEstimate(input)
        : (await this.getRouteEstimate(input)).distanceMeters;
      await runRemote('getDistanceEstimate', () => remoteRepository.getDistanceEstimate(input), remote => {
        const comparison = compareRoute(
          { coordinates: [], distanceMeters: local, durationSeconds: 0 },
          { coordinates: [], distanceMeters: remote, durationSeconds: 0 },
          comparisonPolicy,
        );
        if (comparison.mismatch) recordMismatch('getDistanceEstimate', 'distance', comparison);
      });
      return local;
    },
    async getDurationEstimate(input: RouteEstimateInput) {
      const local = localRepository.getDurationEstimate
        ? await localRepository.getDurationEstimate(input)
        : (await this.getRouteEstimate(input)).durationSeconds;
      await runRemote('getDurationEstimate', () => remoteRepository.getDurationEstimate(input), remote => {
        const comparison = compareRoute(
          { coordinates: [], distanceMeters: 0, durationSeconds: local },
          { coordinates: [], distanceMeters: 0, durationSeconds: remote },
          comparisonPolicy,
        );
        if (comparison.mismatch) recordMismatch('getDurationEstimate', 'duration', comparison);
      });
      return local;
    },
    async getFareEstimatePreview(input: RouteEstimateInput & { vehicleType: VehicleType | string; distanceMeters?: number | null; durationSeconds?: number | null }) {
      const local = localRepository.getFareEstimatePreview
        ? await localRepository.getFareEstimatePreview(input)
        : {
            estimatedAmount: 0,
            currency: 'RWF',
            estimateType: 'preview' as const,
            distanceMeters: input.distanceMeters ?? null,
            durationSeconds: input.durationSeconds ?? null,
            transportType: input.transportType ?? input.vehicleType,
          };
      await runRemote('getFareEstimatePreview', () => remoteRepository.getFareEstimatePreview(input), remote => {
        const comparison = compareFarePreview(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('getFareEstimatePreview', comparison.category, comparison);
      });
      return local;
    },
  };
}
