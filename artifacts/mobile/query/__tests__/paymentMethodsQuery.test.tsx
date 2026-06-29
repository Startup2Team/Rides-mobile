import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { BillingProfile, PaymentMethod } from '@/domains/payments';
import { paymentKeys } from '../keys';
import {
  useAddPaymentMethodMutation,
  useBillingProfileQuery,
  useDefaultPaymentMethodQuery,
  useDeletePaymentMethodMutation,
  usePaymentMethodsQuery,
  useSetDefaultPaymentMethodMutation,
  useUpdatePaymentMethodMutation,
} from '../hooks/usePaymentMethodsQuery';

const mockListPaymentMethods = jest.fn();
const mockGetDefaultPaymentMethod = jest.fn();
const mockGetBillingProfile = jest.fn();
const mockAddPaymentMethod = jest.fn();
const mockUpdatePaymentMethod = jest.fn();
const mockDeletePaymentMethod = jest.fn();
const mockSetDefaultPaymentMethod = jest.fn();

jest.mock('@/domains/payments', () => ({
  paymentsRepository: {
    listPaymentMethods: (...args: unknown[]) => mockListPaymentMethods(...args),
    getDefaultPaymentMethod: (...args: unknown[]) => mockGetDefaultPaymentMethod(...args),
    getBillingProfile: (...args: unknown[]) => mockGetBillingProfile(...args),
    addPaymentMethod: (...args: unknown[]) => mockAddPaymentMethod(...args),
    updatePaymentMethod: (...args: unknown[]) => mockUpdatePaymentMethod(...args),
    deletePaymentMethod: (...args: unknown[]) => mockDeletePaymentMethod(...args),
    setDefaultPaymentMethod: (...args: unknown[]) => mockSetDefaultPaymentMethod(...args),
  },
}));

function cash(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return { id: 'cash_default', provider: 'cash', label: 'Pay with Cash', isDefault: true, ...overrides };
}

function momo(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return { id: 'mtn_1', provider: 'mtn', label: 'MTN Mobile Money', phoneNumber: '788000000', isDefault: false, ...overrides };
}

function createBillingProfile(overrides: Partial<BillingProfile> = {}): BillingProfile {
  return {
    defaultPaymentMethodId: 'cash_default',
    mobileMoneyMethodIds: ['mtn_1'],
    cardMethodIds: [],
    cashEnabled: true,
    preferences: { preferCash: true, preferMobileMoney: false },
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

describe('payment methods query layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads payment methods through the repository', async () => {
    const methods = [cash(), momo()];
    mockListPaymentMethods.mockResolvedValue(methods);
    const { client, wrapper } = createWrapper();

    const { result } = renderHook(() => usePaymentMethodsQuery('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toEqual(methods);
    expect(mockListPaymentMethods).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(paymentKeys.methods('user-1'))).toEqual(methods);
  });

  test('loads default payment method and billing profile through the repository', async () => {
    const defaultMethod = cash();
    const billingProfile = createBillingProfile();
    mockGetDefaultPaymentMethod.mockResolvedValue(defaultMethod);
    mockGetBillingProfile.mockResolvedValue(billingProfile);
    const { client, wrapper } = createWrapper();

    const defaultHook = renderHook(() => useDefaultPaymentMethodQuery('user-1'), { wrapper });
    const billingHook = renderHook(() => useBillingProfileQuery('user-1'), { wrapper });

    await waitFor(() => expect(defaultHook.result.current.isFetched).toBe(true));
    await waitFor(() => expect(billingHook.result.current.isFetched).toBe(true));
    expect(defaultHook.result.current.data).toEqual(defaultMethod);
    expect(billingHook.result.current.data).toEqual(billingProfile);
    expect(client.getQueryData(paymentKeys.default('user-1'))).toEqual(defaultMethod);
    expect(client.getQueryData(paymentKeys.billing('user-1'))).toEqual(billingProfile);
  });

  test('optimistically adds, updates, deletes, and sets default methods', async () => {
    const { client, wrapper } = createWrapper();
    const initial = [cash(), momo()];
    client.setQueryData(paymentKeys.methods('user-1'), initial);
    mockAddPaymentMethod.mockResolvedValue([...initial, momo({ id: 'airtel_1', provider: 'airtel', label: 'Airtel Money' })]);
    mockUpdatePaymentMethod.mockResolvedValue(initial);
    mockDeletePaymentMethod.mockResolvedValue([cash()]);
    mockSetDefaultPaymentMethod.mockResolvedValue([cash({ isDefault: false }), momo({ isDefault: true })]);
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined as never);

    const addHook = renderHook(() => useAddPaymentMethodMutation('user-1'), { wrapper });
    await act(async () => {
      await addHook.result.current.mutateAsync({ id: 'airtel_1', provider: 'airtel', label: 'Airtel Money', phoneNumber: '722000000' });
    });
    expect(client.getQueryData<PaymentMethod[]>(paymentKeys.methods('user-1'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'airtel_1', provider: 'airtel' }),
    ]));
    expect(mockAddPaymentMethod).toHaveBeenCalledWith({ id: 'airtel_1', provider: 'airtel', label: 'Airtel Money', phoneNumber: '722000000' });

    const updateHook = renderHook(() => useUpdatePaymentMethodMutation('user-1'), { wrapper });
    await act(async () => {
      await updateHook.result.current.mutateAsync({ methodId: 'mtn_1', updates: { label: 'Personal MTN' } });
    });
    expect(client.getQueryData<PaymentMethod[]>(paymentKeys.methods('user-1'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mtn_1', label: 'Personal MTN' }),
    ]));

    const defaultHook = renderHook(() => useSetDefaultPaymentMethodMutation('user-1'), { wrapper });
    await act(async () => {
      await defaultHook.result.current.mutateAsync('mtn_1');
    });
    expect(client.getQueryData<PaymentMethod | null>(paymentKeys.default('user-1'))).toEqual(expect.objectContaining({ id: 'mtn_1' }));

    const deleteHook = renderHook(() => useDeletePaymentMethodMutation('user-1'), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync('mtn_1');
    });
    expect(client.getQueryData<PaymentMethod[]>(paymentKeys.methods('user-1'))?.some(method => method.id === 'mtn_1')).toBe(false);
    expect(mockDeletePaymentMethod).toHaveBeenCalledWith('mtn_1');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('rolls back optimistic updates on repository failure', async () => {
    const { client, wrapper } = createWrapper();
    const initial = [cash(), momo()];
    client.setQueryData(paymentKeys.methods('user-1'), initial);
    client.setQueryData(paymentKeys.default('user-1'), initial[0]);
    client.setQueryData(paymentKeys.billing('user-1'), createBillingProfile());
    mockUpdatePaymentMethod.mockRejectedValue(new Error('write failed'));

    const updateHook = renderHook(() => useUpdatePaymentMethodMutation('user-1'), { wrapper });

    await expect(updateHook.result.current.mutateAsync({ methodId: 'mtn_1', updates: { label: 'Broken' } })).rejects.toThrow('write failed');
    expect(client.getQueryData(paymentKeys.methods('user-1'))).toEqual(initial);
    expect(client.getQueryData(paymentKeys.default('user-1'))).toEqual(initial[0]);
    expect(client.getQueryData(paymentKeys.billing('user-1'))).toEqual(createBillingProfile());
  });
});
