import { createNotImplementedError, BackendError, BackendUnavailableError, ConflictError, OfflineError, RateLimitedError, SerializationError, ServerError, TimeoutError, UnauthorizedError, ValidationError, ForbiddenError } from '../contracts/backendErrors';
import type { SavedLocation } from '@/types';
import type {
  CreateSavedLocationRequestDto,
  SavedLocationDto,
  UpdateSavedLocationRequestDto,
} from '../contracts/api';

export function dtoToDomainSavedLocations(dto: SavedLocationDto): SavedLocation {
  return {
    id: dto.id,
    label: dto.label,
    address: dto.address,
    latitude: dto.latitude,
    longitude: dto.longitude,
  };
}

export function domainToCreateSavedLocationDto(
  location: Pick<SavedLocation, 'address' | 'latitude' | 'longitude'>,
  label: string,
  metadata: CreateSavedLocationRequestDto,
): CreateSavedLocationRequestDto {
  return {
    ...metadata,
    label: label.trim(),
    address: location.address ?? '',
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function domainToUpdateSavedLocationDto(
  location: SavedLocation,
  metadata: UpdateSavedLocationRequestDto,
): UpdateSavedLocationRequestDto {
  return {
    ...metadata,
    id: location.id,
    label: location.label.trim(),
    address: location.address ?? '',
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function domainToDtoSavedLocations<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function dtoListToDomainSavedLocations(items: SavedLocationDto[]): SavedLocation[] {
  return items.map(dtoToDomainSavedLocations);
}

export function errorToRepositoryFailureSavedLocations(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'savedLocations', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('savedLocations', 'errorToRepositoryFailure', 'mapper');
}

export function toSavedLocationsRepositoryFailure(error: unknown) {
  return errorToRepositoryFailureSavedLocations(error);
}
