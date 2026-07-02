import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';

export function dtoToDomainPayment<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoPayment<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailurePayment(error: unknown): BackendError {
  return createNotImplementedError('payment', 'errorToRepositoryFailure', 'mapper');
}
