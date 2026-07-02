import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainSavedLocations<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoSavedLocations<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureSavedLocations(error: unknown): BackendError {
  return createNotImplementedError('savedLocations', 'errorToRepositoryFailure', 'mapper');
}
