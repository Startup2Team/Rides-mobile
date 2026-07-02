import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainProfile<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoProfile<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureProfile(error: unknown): BackendError {
  return createNotImplementedError('profile', 'errorToRepositoryFailure', 'mapper');
}
