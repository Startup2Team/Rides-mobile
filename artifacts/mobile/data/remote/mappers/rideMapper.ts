import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainRide<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoRide<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureRide(error: unknown): BackendError {
  return createNotImplementedError('ride', 'errorToRepositoryFailure', 'mapper');
}
