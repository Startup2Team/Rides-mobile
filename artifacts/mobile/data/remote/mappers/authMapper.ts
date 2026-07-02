import { createNotImplementedError } from '../contracts/backendErrors';
import type { BackendError } from '../contracts/backendErrors';
import type { User, DriverProfile } from '@/types';
import type { ApiErrorDto } from '../contracts/api';

export function dtoToDomainAuth<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoAuth<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureAuth(error: unknown): BackendError {
  return createNotImplementedError('auth', 'errorToRepositoryFailure', 'mapper');
}
