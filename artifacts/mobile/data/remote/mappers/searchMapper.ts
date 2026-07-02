import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainSearch<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoSearch<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureSearch(error: unknown): BackendError {
  return createNotImplementedError('search', 'errorToRepositoryFailure', 'mapper');
}
