import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainPackage<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoPackage<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailurePackage(error: unknown): BackendError {
  return createNotImplementedError('package', 'errorToRepositoryFailure', 'mapper');
}
