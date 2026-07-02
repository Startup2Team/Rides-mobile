import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainVehicle<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoVehicle<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureVehicle(error: unknown): BackendError {
  return createNotImplementedError('vehicle', 'errorToRepositoryFailure', 'mapper');
}
