import { paymentRepository as localPaymentRepository } from '@/data/repositories';
import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import type {
  BillingProfileDto,
  GetBillingProfileResponseDto,
  GetDefaultPaymentMethodResponseDto,
  ListPaymentMethodsResponseDto,
  PaymentMethodDto,
  PaymentMethodsMutationResponseDto,
} from '../contracts/api';
import { BackendClient } from '../client/backendClient';
import type { BackendError } from '../contracts/backendErrors';
import { createBackendUnavailableError } from '../contracts/backendErrors';
import {
  dtoListToDomainPaymentMethods,
  dtoToDomainBillingProfile,
  dtoToDomainPaymentMethod,
  domainToAddPaymentMethodDto,
  domainToDeletePaymentMethodDto,
  domainToSetDefaultPaymentMethodDto,
  domainToUpdatePaymentMethodDto,
  errorToRepositoryFailurePayment,
  getDefaultPaymentMethodFromResponse,
} from '../mappers/paymentMapper';
import { observability } from '@/observability/context/observabilityContext';
import type { BillingProfile, PaymentMethod, PaymentProvider } from '@/domains/payments/types';

export interface RemotePaymentRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface PaymentShadowRepository {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  getDefaultPaymentMethod(): Promise<PaymentMethod | null>;
  getBillingProfile(): Promise<BillingProfile>;
  addPaymentMethod(method: PaymentMethod): Promise<void>;
  updatePaymentMethod(methodId: string, updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>): Promise<void>;
  removePaymentMethod(methodId: string): Promise<void>;
  setDefaultPaymentMethod(methodId: string): Promise<void>;
}

export interface PaymentShadowLocalRepository {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  addPaymentMethod(method: PaymentMethod): Promise<void>;
  updatePaymentMethod(methodId: string, updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>): Promise<void>;
  removePaymentMethod(methodId: string): Promise<void>;
  setDefaultPaymentMethod(methodId: string): Promise<void>;
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function summarizePaymentMethod(method: PaymentMethod) {
  return {
    id: method.id,
    provider: method.provider,
    label: method.label,
    phoneNumber: method.phoneNumber ?? null,
    isDefault: method.isDefault,
  };
}

function summarizeBillingProfile(profile: BillingProfile) {
  return {
    defaultPaymentMethodId: profile.defaultPaymentMethodId,
    mobileMoneyMethodIds: [...profile.mobileMoneyMethodIds],
    cardMethodIds: [...profile.cardMethodIds],
    cashEnabled: profile.cashEnabled,
    preferences: { ...profile.preferences },
  };
}

function normalizeMethods(methods: PaymentMethod[]) {
  const defaultMethod = methods.find(method => method.isDefault) ?? methods[0] ?? null;
  if (!defaultMethod) return methods;
  return methods.map(method => ({ ...method, isDefault: method.id === defaultMethod.id }));
}

function normalizeCashFallback(methods: PaymentMethod[]) {
  if (methods.length > 0) return normalizeMethods(methods);
  return [{
    id: 'cash_default',
    provider: 'cash' as PaymentProvider,
    label: 'Pay with Cash',
    isDefault: true,
  }];
}

function buildBillingProfile(methods: PaymentMethod[]): BillingProfile {
  const normalized = normalizeCashFallback(methods);
  const defaultMethod = normalized.find(method => method.isDefault) ?? null;
  const mobileMoneyMethodIds = normalized.filter(method => method.provider === 'mtn' || method.provider === 'airtel').map(method => method.id);
  const cardMethodIds = normalized.filter(method => method.provider === 'cash' ? false : false).map(method => method.id);
  return {
    defaultPaymentMethodId: defaultMethod?.id ?? null,
    mobileMoneyMethodIds,
    cardMethodIds,
    cashEnabled: normalized.some(method => method.provider === 'cash'),
    preferences: {
      preferCash: defaultMethod?.provider === 'cash',
      preferMobileMoney: defaultMethod?.provider === 'mtn' || defaultMethod?.provider === 'airtel',
    },
  };
}

function recordTelemetry(
  event: 'payment-method shadow request' | 'payment-method shadow success' | 'payment-method shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('payment_method.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('payment_method.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('PaymentMethodRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown, detail: string) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('payment_method.remote.shape_mismatch', 1, { method, detail });
  }
  observability.metrics.counter('payment_method.remote.semantic_mismatch', 1, { method, detail });
  observability.logger.warn('PaymentMethodRemoteShadowMismatch', {
    method,
    detail,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailurePayment(error);
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('payment', method, 'remote');
  return client;
}

function buildMetadata(method: string, seed: string): ApiIdempotencyMetadata {
  const timestamp = new Date().toISOString();
  return {
    idempotencyKey: `payment-shadow:${method}:${seed}`,
    correlationId: `payment-shadow:${method}:${seed}`,
    actorId: seed,
    actorRole: 'customer',
    clientTimestamp: timestamp,
  };
}

function mutationResponseToMethods(
  response: PaymentMethodsMutationResponseDto['data'] | ListPaymentMethodsResponseDto['data'],
): PaymentMethod[] {
  const data = response as unknown as {
    items?: PaymentMethodDto[];
    method?: PaymentMethodDto | null;
    defaultPaymentMethod?: PaymentMethodDto | null;
  } | undefined;
  if (data?.items) return dtoListToDomainPaymentMethods(data.items);
  if (data?.method) return normalizeMethods([dtoToDomainPaymentMethod(data.method)]);
  if (data?.defaultPaymentMethod) return normalizeMethods([dtoToDomainPaymentMethod(data.defaultPaymentMethod)]);
  return [];
}

export class RemotePaymentRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemotePaymentRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('payment-method shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('payment-method shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('payment-method shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async listPaymentMethods(): Promise<PaymentMethod[]> {
    return this.shadow('listPaymentMethods', async () => {
      const client = resolveClient('listPaymentMethods', this.client);
      const response = await client.get<ListPaymentMethodsResponseDto>('/v1/payments/methods');
      return normalizeCashFallback(dtoListToDomainPaymentMethods(response.data?.data?.items ?? []));
    });
  }

  async getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
    return this.shadow('getDefaultPaymentMethod', async () => {
      const client = resolveClient('getDefaultPaymentMethod', this.client);
      const response = await client.get<GetDefaultPaymentMethodResponseDto>('/v1/payments/methods/default');
      return getDefaultPaymentMethodFromResponse(response.data.data ?? null, await this.listPaymentMethods().catch(() => []));
    });
  }

  async getBillingProfile(): Promise<BillingProfile> {
    return this.shadow('getBillingProfile', async () => {
      const client = resolveClient('getBillingProfile', this.client);
      const [billingResponse, methods, defaultMethodResponse] = await Promise.all([
        client.get<GetBillingProfileResponseDto>('/v1/payments/billing-profile'),
        this.listPaymentMethods().catch(() => []),
        client.get<GetDefaultPaymentMethodResponseDto>('/v1/payments/methods/default').catch(() => null),
      ]);
      const defaultMethod = defaultMethodResponse
        ? getDefaultPaymentMethodFromResponse(defaultMethodResponse.data.data ?? null, methods)
        : methods.find(method => method.isDefault) ?? null;
      return dtoToDomainBillingProfile(billingResponse.data.data, defaultMethod ? [defaultMethod] : methods);
    });
  }

  async addPaymentMethod(method: PaymentMethod, metadata: ApiIdempotencyMetadata): Promise<PaymentMethod[]> {
    return this.shadow('addPaymentMethod', async () => {
      const client = resolveClient('addPaymentMethod', this.client);
      const response = await client.post<PaymentMethodsMutationResponseDto>('/v1/payments/methods', {
        body: domainToAddPaymentMethodDto(method, metadata),
      });
      return normalizeCashFallback(mutationResponseToMethods(response.data.data));
    });
  }

  async updatePaymentMethod(
    methodId: string,
    updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>,
    metadata: ApiIdempotencyMetadata,
  ): Promise<PaymentMethod[]> {
    return this.shadow('updatePaymentMethod', async () => {
      const client = resolveClient('updatePaymentMethod', this.client);
      const response = await client.patch<PaymentMethodsMutationResponseDto>(`/v1/payments/methods/${methodId}`, {
        body: domainToUpdatePaymentMethodDto(methodId, updates, metadata),
      });
      return normalizeCashFallback(mutationResponseToMethods(response.data.data));
    });
  }

  async deletePaymentMethod(methodId: string, metadata: ApiIdempotencyMetadata): Promise<PaymentMethod[]> {
    return this.shadow('deletePaymentMethod', async () => {
      const client = resolveClient('deletePaymentMethod', this.client);
      const response = await client.delete<PaymentMethodsMutationResponseDto>(`/v1/payments/methods/${methodId}`, {
        body: domainToDeletePaymentMethodDto(methodId, metadata),
      });
      const next = mutationResponseToMethods(response.data.data);
      if (response.data?.data?.deleted && next.length > 0) return normalizeCashFallback(next);
      return normalizeCashFallback(next);
    });
  }

  async setDefaultPaymentMethod(methodId: string, metadata: ApiIdempotencyMetadata): Promise<PaymentMethod[]> {
    return this.shadow('setDefaultPaymentMethod', async () => {
      const client = resolveClient('setDefaultPaymentMethod', this.client);
      const response = await client.patch<PaymentMethodsMutationResponseDto>(`/v1/payments/methods/${methodId}/default`, {
        body: domainToSetDefaultPaymentMethodDto(methodId, metadata),
      });
      return normalizeCashFallback(mutationResponseToMethods(response.data.data));
    });
  }
}

export function createRemotePaymentRepositoryPrototype(options: RemotePaymentRepositoryOptions = {}) {
  return new RemotePaymentRepository(options);
}

export function createPaymentShadowRepository(options: {
  localRepository?: PaymentShadowLocalRepository;
  remoteRepository: RemotePaymentRepository;
}) : PaymentShadowRepository {
  const localRepository = options.localRepository ?? localPaymentRepository;
  const { remoteRepository } = options;

  async function compareAndReturn<T>(
    method: string,
    local: () => Promise<T>,
    remote: () => Promise<T>,
    compare: (localValue: T, remoteValue: T) => void,
  ): Promise<T> {
    const localValue = await local();
    try {
      const remoteValue = await remote();
      compare(localValue, remoteValue);
    } catch (error) {
      observability.logger.warn('PaymentMethodRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  return {
    async listPaymentMethods() {
      return compareAndReturn(
        'listPaymentMethods',
        async () => normalizeCashFallback(await localRepository.listPaymentMethods()),
        () => remoteRepository.listPaymentMethods(),
        (localValue, remoteValue) => {
          const localShape = localValue.map(summarizePaymentMethod);
          const remoteShape = remoteValue.map(summarizePaymentMethod);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('listPaymentMethods', localShape, remoteShape, 'payment-methods');
          }
        },
      );
    },
    async getDefaultPaymentMethod() {
      return compareAndReturn(
        'getDefaultPaymentMethod',
        async () => {
          const methods = normalizeCashFallback(await localRepository.listPaymentMethods());
          return methods.find(method => method.isDefault) ?? null;
        },
        () => remoteRepository.getDefaultPaymentMethod(),
        (localValue, remoteValue) => {
          const localShape = localValue ? summarizePaymentMethod(localValue) : null;
          const remoteShape = remoteValue ? summarizePaymentMethod(remoteValue) : null;
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getDefaultPaymentMethod', localShape, remoteShape, 'default-payment-method');
          }
        },
      );
    },
    async getBillingProfile() {
      return compareAndReturn(
        'getBillingProfile',
        async () => buildBillingProfile(await localRepository.listPaymentMethods()),
        () => remoteRepository.getBillingProfile(),
        (localValue, remoteValue) => {
          const localShape = summarizeBillingProfile(localValue);
          const remoteShape = summarizeBillingProfile(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getBillingProfile', localShape, remoteShape, 'billing-profile');
          }
        },
      );
    },
    async addPaymentMethod(method: PaymentMethod) {
      await localRepository.addPaymentMethod(method);
      try {
        const remoteValue = await remoteRepository.addPaymentMethod(method, buildMetadata('addPaymentMethod', method.id));
        const localValue = normalizeCashFallback(await localRepository.listPaymentMethods());
        recordMismatch('addPaymentMethod', localValue.map(summarizePaymentMethod), remoteValue.map(summarizePaymentMethod), 'mutation');
      } catch (error) {
        observability.logger.warn('PaymentMethodRemoteShadowFailure', {
          method: 'addPaymentMethod',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async updatePaymentMethod(methodId: string, updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>) {
      await localRepository.updatePaymentMethod(methodId, updates);
      try {
        const remoteValue = await remoteRepository.updatePaymentMethod(methodId, updates, buildMetadata('updatePaymentMethod', methodId));
        const localValue = normalizeCashFallback(await localRepository.listPaymentMethods());
        recordMismatch('updatePaymentMethod', localValue.map(summarizePaymentMethod), remoteValue.map(summarizePaymentMethod), 'mutation');
      } catch (error) {
        observability.logger.warn('PaymentMethodRemoteShadowFailure', {
          method: 'updatePaymentMethod',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async removePaymentMethod(methodId: string) {
      await localRepository.removePaymentMethod(methodId);
      try {
        const remoteValue = await remoteRepository.deletePaymentMethod(methodId, buildMetadata('deletePaymentMethod', methodId));
        const localValue = normalizeCashFallback(await localRepository.listPaymentMethods());
        recordMismatch('deletePaymentMethod', localValue.map(summarizePaymentMethod), remoteValue.map(summarizePaymentMethod), 'mutation');
      } catch (error) {
        observability.logger.warn('PaymentMethodRemoteShadowFailure', {
          method: 'deletePaymentMethod',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async setDefaultPaymentMethod(methodId: string) {
      await localRepository.setDefaultPaymentMethod(methodId);
      try {
        const remoteValue = await remoteRepository.setDefaultPaymentMethod(methodId, buildMetadata('setDefaultPaymentMethod', methodId));
        const localValue = normalizeCashFallback(await localRepository.listPaymentMethods());
        recordMismatch('setDefaultPaymentMethod', localValue.map(summarizePaymentMethod), remoteValue.map(summarizePaymentMethod), 'mutation');
      } catch (error) {
        observability.logger.warn('PaymentMethodRemoteShadowFailure', {
          method: 'setDefaultPaymentMethod',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
  };
}
