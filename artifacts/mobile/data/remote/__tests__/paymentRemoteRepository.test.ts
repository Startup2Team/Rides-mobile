import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemotePaymentRepository, createPaymentShadowRepository } from '../repositories/RemotePaymentRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import type { BillingProfile, PaymentMethod } from '@/domains/payments/types';
import type { PaymentRepository } from '@/data/repositories/interfaces';

const cashMethod: PaymentMethod = {
  id: 'cash_default',
  provider: 'cash',
  label: 'Pay with Cash',
  isDefault: true,
};

const momoMethod: PaymentMethod = {
  id: 'mtn_1',
  provider: 'mtn',
  label: 'MTN Mobile Money',
  phoneNumber: '788000000',
  isDefault: false,
};

const airtelMethod: PaymentMethod = {
  id: 'airtel_1',
  provider: 'airtel',
  label: 'Airtel Money',
  phoneNumber: '722000000',
  isDefault: false,
};

const billingProfile: BillingProfile = {
  defaultPaymentMethodId: 'cash_default',
  mobileMoneyMethodIds: ['mtn_1', 'airtel_1'],
  cardMethodIds: [],
  cashEnabled: true,
  preferences: { preferCash: true, preferMobileMoney: false },
};

const shadowBillingProfile: BillingProfile = {
  defaultPaymentMethodId: 'cash_default',
  mobileMoneyMethodIds: ['mtn_1'],
  cardMethodIds: [],
  cashEnabled: true,
  preferences: { preferCash: true, preferMobileMoney: false },
};

function createMetadata(overrides: Partial<{
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: 'customer' | 'driver' | 'system';
  clientTimestamp: string;
}> = {}) {
  return {
    idempotencyKey: 'payment:meta:1',
    correlationId: 'corr-payment-1',
    actorId: 'user-1',
    actorRole: 'customer' as const,
    clientTimestamp: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

function createLocalRepository(overrides: Partial<PaymentRepository> = {}): PaymentRepository {
  return {
    listPaymentMethods: jest.fn(async () => [cashMethod, momoMethod]),
    savePaymentMethods: jest.fn(async () => undefined),
    addPaymentMethod: jest.fn(async () => undefined),
    updatePaymentMethod: jest.fn(async () => undefined),
    removePaymentMethod: jest.fn(async () => undefined),
    setDefaultPaymentMethod: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('RemotePaymentRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('maps payment methods dto to domain', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/payments/methods',
        response: {
          status: 200,
          data: {
            data: {
              items: [cashMethod, momoMethod],
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.listPaymentMethods()).resolves.toEqual([cashMethod, momoMethod]);
  });

  test('maps default payment method dto to domain', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/payments/methods/default',
        response: {
          status: 200,
          data: {
            data: cashMethod,
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/payments/methods',
        response: {
          status: 200,
          data: {
            data: { items: [cashMethod, momoMethod] },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getDefaultPaymentMethod()).resolves.toEqual(cashMethod);
  });

  test('maps billing profile dto to domain', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/payments/billing-profile',
        response: {
          status: 200,
          data: {
            data: {
              defaultPaymentMethodId: 'cash_default',
              mobileMoneyMethodIds: ['mtn_1', 'airtel_1'],
              cardMethodIds: [],
              cashEnabled: true,
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/payments/methods/default',
        response: {
          status: 200,
          data: {
            data: cashMethod,
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/payments/methods',
        response: {
          status: 200,
          data: {
            data: { items: [cashMethod, momoMethod, airtelMethod] },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getBillingProfile()).resolves.toEqual(billingProfile);
  });

  test('add update delete and default payment method map correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/payments/methods',
        response: {
          status: 200,
          data: {
            data: { items: [cashMethod, momoMethod, airtelMethod] },
            version: 'v1',
          },
        },
      },
      {
        method: 'PATCH',
        path: '/v1/payments/methods/mtn_1',
        response: {
          status: 200,
          data: {
            data: { items: [cashMethod, { ...momoMethod, label: 'Personal MTN' }] },
            version: 'v1',
          },
        },
      },
      {
        method: 'DELETE',
        path: '/v1/payments/methods/mtn_1',
        response: {
          status: 200,
          data: {
            data: { items: [cashMethod] },
            version: 'v1',
          },
        },
      },
      {
        method: 'PATCH',
        path: '/v1/payments/methods/mtn_1/default',
        response: {
          status: 200,
          data: {
            data: { items: [{ ...cashMethod, isDefault: false }, { ...momoMethod, isDefault: true }] },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.addPaymentMethod(airtelMethod, createMetadata())).resolves.toEqual([cashMethod, momoMethod, airtelMethod]);
    await expect(repo.updatePaymentMethod('mtn_1', { label: 'Personal MTN' }, createMetadata())).resolves.toEqual([cashMethod, { ...momoMethod, label: 'Personal MTN' }]);
    await expect(repo.deletePaymentMethod('mtn_1', createMetadata())).resolves.toEqual([cashMethod]);
    await expect(repo.setDefaultPaymentMethod('mtn_1', createMetadata())).resolves.toEqual([{ ...cashMethod, isDefault: false }, { ...momoMethod, isDefault: true }]);

    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/payments/methods',
      body: expect.objectContaining({
        provider: 'airtel',
        idempotencyKey: 'payment:meta:1',
      }),
    });
    expect(transportFixture.calls[1]).toMatchObject({
      method: 'PATCH',
      path: '/v1/payments/methods/mtn_1',
      body: expect.objectContaining({
        methodId: 'mtn_1',
        label: 'Personal MTN',
      }),
    });
    expect(transportFixture.calls[2]).toMatchObject({
      method: 'DELETE',
      path: '/v1/payments/methods/mtn_1',
      body: expect.objectContaining({
        methodId: 'mtn_1',
      }),
    });
    expect(transportFixture.calls[3]).toMatchObject({
      method: 'PATCH',
      path: '/v1/payments/methods/mtn_1/default',
      body: expect.objectContaining({
        methodId: 'mtn_1',
      }),
    });
  });

  test('typed backend errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/payments/methods', error: new TimeoutError({ repository: 'payment', method: 'listPaymentMethods', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/payments/methods', error: new OfflineError({ repository: 'payment', method: 'addPaymentMethod', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'PATCH', path: '/v1/payments/methods/mtn_1', error: new ServerError({ repository: 'payment', method: 'updatePaymentMethod', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemotePaymentRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemotePaymentRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemotePaymentRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.listPaymentMethods()).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.addPaymentMethod(airtelMethod, createMetadata())).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.updatePaymentMethod('mtn_1', { label: 'Broken' }, createMetadata())).rejects.toBeInstanceOf(ServerError);
  });
});

describe('payment shadow remote repository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('returns local results even when remote fails', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/payments/methods', error: new TimeoutError({ repository: 'payment', method: 'listPaymentMethods', transport: 'remote' }) },
      { method: 'GET', path: '/v1/payments/methods/default', error: new TimeoutError({ repository: 'payment', method: 'getDefaultPaymentMethod', transport: 'remote' }) },
      { method: 'GET', path: '/v1/payments/billing-profile', error: new TimeoutError({ repository: 'payment', method: 'getBillingProfile', transport: 'remote' }) },
      { method: 'POST', path: '/v1/payments/methods', error: new TimeoutError({ repository: 'payment', method: 'addPaymentMethod', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/payments/methods/mtn_1', error: new TimeoutError({ repository: 'payment', method: 'updatePaymentMethod', transport: 'remote' }) },
      { method: 'DELETE', path: '/v1/payments/methods/mtn_1', error: new TimeoutError({ repository: 'payment', method: 'deletePaymentMethod', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/payments/methods/mtn_1/default', error: new TimeoutError({ repository: 'payment', method: 'setDefaultPaymentMethod', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createPaymentShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.listPaymentMethods()).resolves.toEqual([cashMethod, momoMethod]);
    await expect(shadowRepository.getDefaultPaymentMethod()).resolves.toEqual(cashMethod);
    await expect(shadowRepository.getBillingProfile()).resolves.toEqual(shadowBillingProfile);
    await expect(shadowRepository.addPaymentMethod(airtelMethod)).resolves.toBeUndefined();
    await expect(shadowRepository.updatePaymentMethod('mtn_1', { label: 'Personal MTN' })).resolves.toBeUndefined();
    await expect(shadowRepository.removePaymentMethod('mtn_1')).resolves.toBeUndefined();
    await expect(shadowRepository.setDefaultPaymentMethod('mtn_1')).resolves.toBeUndefined();

    expect(localRepository.listPaymentMethods).toHaveBeenCalled();
    expect(localRepository.addPaymentMethod).toHaveBeenCalledWith(airtelMethod);
    expect(localRepository.updatePaymentMethod).toHaveBeenCalledWith('mtn_1', { label: 'Personal MTN' });
    expect(localRepository.removePaymentMethod).toHaveBeenCalledWith('mtn_1');
    expect(localRepository.setDefaultPaymentMethod).toHaveBeenCalledWith('mtn_1');
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/payments/methods',
        response: {
          status: 200,
          data: {
            data: {
              items: [
                { ...cashMethod, label: 'Remote Cash' },
                { ...momoMethod, label: 'Remote MTN' },
              ],
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/payments/methods/default',
        response: {
          status: 200,
          data: {
            data: { ...cashMethod, label: 'Remote Cash' },
            version: 'v1',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/payments/billing-profile',
        response: {
          status: 200,
          data: {
            data: {
              defaultPaymentMethodId: 'cash_default',
              mobileMoneyMethodIds: ['mtn_1'],
              cardMethodIds: [],
              cashEnabled: true,
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemotePaymentRepository({
      client: new BackendClient({ transport: transportFixture.transport } as any),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createPaymentShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.listPaymentMethods()).resolves.toEqual([cashMethod, momoMethod]);
    await expect(shadowRepository.getDefaultPaymentMethod()).resolves.toEqual(cashMethod);
    await expect(shadowRepository.getBillingProfile()).resolves.toEqual(shadowBillingProfile);

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'payment_method.remote.shadow',
      'payment_method.remote.latency_ms',
      'payment_method.remote.semantic_mismatch',
    ]));
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
