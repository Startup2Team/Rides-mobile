import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import {
  BackendError,
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import type {
  AddPaymentMethodRequestDto,
  BillingProfileDto,
  DeletePaymentMethodRequestDto,
  GetDefaultPaymentMethodResponseDto,
  PaymentMethodDto,
  SetDefaultPaymentMethodRequestDto,
  UpdatePaymentMethodRequestDto,
} from '../contracts/api';
import type { BillingProfile, PaymentMethod, AddPaymentMethodInput, UpdatePaymentMethodInput } from '@/domains/payments/types';

function mapArray<TInput, TOutput>(items: TInput[] | null | undefined, mapper: (item: TInput) => TOutput): TOutput[] {
  return (items ?? []).map(mapper);
}

function normalizePhoneNumber(phoneNumber?: string | null) {
  return phoneNumber ?? null;
}

function inferDefaultMethodPreferences(methods: PaymentMethod[], defaultMethodId: string | null) {
  const defaultMethod = methods.find(method => method.id === defaultMethodId) ?? null;
  const provider = defaultMethod?.provider ?? null;
  return {
    preferCash: provider === 'cash',
    preferMobileMoney: provider === 'mtn' || provider === 'airtel',
  };
}

function coercePaymentMethods(methods: PaymentMethod[] | null | undefined) {
  const normalized = mapArray(methods, dto => dto);
  const defaultMethod = normalized.find(method => method.isDefault);
  if (defaultMethod) {
    return normalized.map(method => ({ ...method, isDefault: method.id === defaultMethod.id }));
  }
  if (normalized.length === 0) return normalized;
  return normalized.map((method, index) => ({ ...method, isDefault: index === 0 }));
}

export function dtoToDomainPaymentMethod(dto: PaymentMethodDto): PaymentMethod {
  return {
    id: dto.id,
    provider: dto.provider as PaymentMethod['provider'],
    label: dto.label,
    phoneNumber: dto.phoneNumber ?? undefined,
    isDefault: dto.isDefault,
  };
}

export function dtoListToDomainPaymentMethods(items: PaymentMethodDto[] | null | undefined): PaymentMethod[] {
  return coercePaymentMethods(mapArray(items, dtoToDomainPaymentMethod));
}

export function domainToPaymentMethodDto(method: PaymentMethod): PaymentMethodDto {
  return {
    id: method.id,
    provider: method.provider,
    label: method.label,
    phoneNumber: normalizePhoneNumber(method.phoneNumber),
    isDefault: method.isDefault,
  };
}

export function dtoToDomainBillingProfile(
  dto: BillingProfileDto,
  methods: PaymentMethod[] = [],
): BillingProfile {
  return {
    defaultPaymentMethodId: dto.defaultPaymentMethodId,
    mobileMoneyMethodIds: [...dto.mobileMoneyMethodIds],
    cardMethodIds: [...dto.cardMethodIds],
    cashEnabled: dto.cashEnabled,
    preferences: inferDefaultMethodPreferences(methods, dto.defaultPaymentMethodId),
  };
}

export function domainToBillingProfileDto(profile: BillingProfile): BillingProfileDto {
  return {
    defaultPaymentMethodId: profile.defaultPaymentMethodId,
    mobileMoneyMethodIds: [...profile.mobileMoneyMethodIds],
    cardMethodIds: [...profile.cardMethodIds],
    cashEnabled: profile.cashEnabled,
  };
}

export function domainToAddPaymentMethodDto(
  input: AddPaymentMethodInput | PaymentMethod,
  metadata: ApiIdempotencyMetadata,
): AddPaymentMethodRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    provider: input.provider,
    label: input.label,
    phoneNumber: normalizePhoneNumber(input.phoneNumber),
    isDefault: 'isDefault' in input ? input.isDefault ?? undefined : undefined,
  };
}

export function domainToUpdatePaymentMethodDto(
  methodId: string,
  updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>,
  metadata: ApiIdempotencyMetadata,
): UpdatePaymentMethodRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    methodId,
    label: updates.label ?? null,
    phoneNumber: normalizePhoneNumber(updates.phoneNumber),
    isDefault: updates.isDefault ?? null,
  };
}

export function domainToDeletePaymentMethodDto(
  methodId: string,
  metadata: ApiIdempotencyMetadata,
): DeletePaymentMethodRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    methodId,
  };
}

export function domainToSetDefaultPaymentMethodDto(
  methodId: string,
  metadata: ApiIdempotencyMetadata,
): SetDefaultPaymentMethodRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    methodId,
  };
}

export function getDefaultPaymentMethodFromResponse(
  method: PaymentMethodDto | null,
  methods: PaymentMethod[] = [],
): PaymentMethod | null {
  if (!method) return null;
  const domainMethod = dtoToDomainPaymentMethod(method);
  const preferred = methods.find(item => item.id === domainMethod.id);
  if (preferred) return { ...preferred, ...domainMethod };
  return domainMethod;
}

export function dtoToDomainPayment<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoPayment<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailurePayment(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'payment', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('payment', 'errorToRepositoryFailure', 'mapper');
}

export function toPaymentRepositoryFailure(error: unknown) {
  return errorToRepositoryFailurePayment(error);
}
