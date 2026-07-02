import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainMap<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoMap<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureMap(error: unknown): BackendError {
  return createNotImplementedError('map', 'errorToRepositoryFailure', 'mapper');
}
