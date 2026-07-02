import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainNotification<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoNotification<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureNotification(error: unknown): BackendError {
  return createNotImplementedError('notification', 'errorToRepositoryFailure', 'mapper');
}
