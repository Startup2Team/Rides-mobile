import type { GeocodeSuggestion } from '@/services/geocoding';
import type { Coords, RideLocation } from '@/types';
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
  SearchRequestDto,
  SearchReverseGeocodeRequestDto,
  SearchSuggestionDto,
} from '../contracts/api';

export interface SearchPlacesInput {
  query: string;
  near?: Coords;
  limit?: number;
  sessionId?: string | null;
  correlationId?: string | null;
}

export function dtoToDomainSearchResult(dto: SearchSuggestionDto): GeocodeSuggestion {
  const title = dto.shortName ?? dto.label ?? dto.displayName ?? dto.address ?? 'Location';
  const placeName = dto.displayName ?? dto.address ?? dto.label ?? title;
  return {
    id: dto.id,
    place_name: placeName,
    title,
    subtitle: dto.subtitle ?? dto.address ?? undefined,
    coords: { latitude: dto.latitude, longitude: dto.longitude },
    featureType: dto.category ?? dto.type ?? undefined,
    source: 'mapbox',
  };
}

export function dtoListToDomainSearchResults(items: SearchSuggestionDto[] | null | undefined): GeocodeSuggestion[] {
  return (items ?? []).map(dtoToDomainSearchResult);
}

export function dtoToDomainPlaceDetail(dto: SearchSuggestionDto | null | undefined): GeocodeSuggestion | null {
  return dto ? dtoToDomainSearchResult(dto) : null;
}

export function dtoToDomainReverseGeocode(dto: SearchSuggestionDto | null | undefined): RideLocation | null {
  if (!dto) return null;
  return {
    latitude: dto.latitude,
    longitude: dto.longitude,
    address: dto.address ?? dto.displayName ?? dto.label ?? undefined,
  };
}

export function domainToSearchRequestDto(input: SearchPlacesInput): SearchRequestDto {
  return {
    query: input.query,
    near: input.near ? { latitude: input.near.latitude, longitude: input.near.longitude } : null,
    limit: input.limit,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
  };
}

export function domainToSearchReverseGeocodeDto(coords: Coords, correlationId?: string | null): SearchReverseGeocodeRequestDto {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    correlationId,
  };
}

export function dtoToDomainSearch<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoSearch<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureSearch(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'search', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('search', 'errorToRepositoryFailure', 'mapper');
}
