import type { RouteResult } from '@/services/mapbox';
import type { Coords, RideLocation, VehicleType } from '@/types';
import {
  BackendError,
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import type {
  FareEstimateRequestDto,
  FareEstimateResponseDto,
  ReverseGeocodeRequestDto,
  RouteEstimateRequestDto,
  RoutePreviewDto,
  RoutePreviewRequestDto,
} from '../contracts/api';

export interface RouteEstimateInput {
  origin: Coords;
  destination: Coords;
  transportType?: VehicleType | string | null;
  correlationId?: string | null;
}

export interface FareEstimatePreview {
  estimatedAmount: number;
  currency: string;
  estimateType: 'preview';
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  transportType?: string | null;
  pricingVersion?: string | null;
  expiresAt?: string | null;
  estimatedAt?: string | null;
}

export function dtoToDomainRouteEstimate(dto: RoutePreviewDto): RouteResult {
  return {
    coordinates: dto.geometry ?? [],
    distanceMeters: dto.distanceMeters,
    durationSeconds: dto.durationSeconds,
  };
}

export function dtoToDomainRoutePreview(dto: RoutePreviewDto): RouteResult & {
  routeId?: string | null;
  geometryReference?: string | null;
  transportType?: string | null;
  estimatedAt?: string | null;
} {
  return {
    ...dtoToDomainRouteEstimate(dto),
    routeId: dto.routeId,
    geometryReference: dto.geometryReference,
    transportType: dto.transportType,
    estimatedAt: dto.estimatedAt,
  };
}

export function dtoToDomainDistanceEstimate(dto: { distanceMeters: number }): number {
  return dto.distanceMeters;
}

export function dtoToDomainDurationEstimate(dto: { durationSeconds: number }): number {
  return dto.durationSeconds;
}

export function dtoToDomainFareEstimatePreview(dto: FareEstimateResponseDto['data']): FareEstimatePreview {
  return {
    estimatedAmount: dto.estimatedAmount,
    currency: dto.currency,
    estimateType: 'preview',
    distanceMeters: dto.distanceMeters,
    durationSeconds: dto.durationSeconds,
    transportType: dto.transportType,
    pricingVersion: dto.pricingVersion,
    expiresAt: dto.expiresAt,
    estimatedAt: dto.estimatedAt,
  };
}

export function dtoToDomainReverseGeocodeMap(dto: { address: string; latitude: number; longitude: number } | null | undefined): RideLocation | null {
  if (!dto) return null;
  return {
    address: dto.address,
    latitude: dto.latitude,
    longitude: dto.longitude,
  };
}

export function domainToRouteEstimateDto(input: RouteEstimateInput): RouteEstimateRequestDto {
  return {
    origin: { latitude: input.origin.latitude, longitude: input.origin.longitude },
    destination: { latitude: input.destination.latitude, longitude: input.destination.longitude },
    transportType: input.transportType,
    correlationId: input.correlationId,
  };
}

export function domainToRoutePreviewDto(input: RouteEstimateInput): RoutePreviewRequestDto {
  return {
    ...domainToRouteEstimateDto(input),
    includeGeometry: true,
    includeSteps: true,
  };
}

export function domainToReverseGeocodeDto(coords: Coords, correlationId?: string | null): ReverseGeocodeRequestDto {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    correlationId,
  };
}

export function domainToFareEstimateDto(input: RouteEstimateInput & {
  vehicleType: VehicleType | string;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
}): FareEstimateRequestDto {
  return {
    vehicleType: input.vehicleType,
    pickup: { latitude: input.origin.latitude, longitude: input.origin.longitude },
    destination: { latitude: input.destination.latitude, longitude: input.destination.longitude },
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    correlationId: input.correlationId,
  };
}

export function dtoToDomainMap<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoMap<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureMap(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'map', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('map', 'errorToRepositoryFailure', 'mapper');
}
