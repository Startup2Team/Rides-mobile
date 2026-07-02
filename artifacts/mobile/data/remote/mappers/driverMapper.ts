import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainDriver<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoDriver<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureDriver(error: unknown): BackendError {
  return createNotImplementedError('driver', 'errorToRepositoryFailure', 'mapper');
}
