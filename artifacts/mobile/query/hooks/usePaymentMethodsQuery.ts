import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsRepository } from '@/domains/payments';
import type { AddPaymentMethodInput, PaymentMethod, UpdatePaymentMethodInput } from '@/domains/payments';
import { paymentKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

type PaymentMutationContext = {
  previousBilling: unknown;
  previousDefault: PaymentMethod | null | undefined;
  previousMethods: PaymentMethod[];
};

function resolveUserId(userId?: string | null) {
  return userId ?? 'current';
}

function normalizeDefault(methods: PaymentMethod[]): PaymentMethod[] {
  const defaultMethod = methods.find(method => method.isDefault);
  if (defaultMethod) {
    return methods.map(method => ({ ...method, isDefault: method.id === defaultMethod.id }));
  }
  if (methods.length === 0) return methods;
  return methods.map((method, index) => ({ ...method, isDefault: index === 0 }));
}

function optimisticAdd(methods: PaymentMethod[], input: AddPaymentMethodInput) {
  const nextMethod: PaymentMethod = {
    id: input.id,
    provider: input.provider,
    label: input.label,
    phoneNumber: input.phoneNumber,
    isDefault: input.isDefault ?? methods.length === 0,
  };
  return normalizeDefault([
    ...methods.map(method => nextMethod.isDefault ? { ...method, isDefault: false } : method),
    nextMethod,
  ]);
}

function optimisticUpdate(methods: PaymentMethod[], input: UpdatePaymentMethodInput) {
  const next = methods.map(method => {
    if (method.id === input.methodId) {
      return { ...method, ...input.updates, id: method.id, provider: method.provider };
    }
    return input.updates.isDefault === true ? { ...method, isDefault: false } : method;
  });
  return normalizeDefault(next);
}

function optimisticDelete(methods: PaymentMethod[], methodId: string) {
  return normalizeDefault(methods.filter(method => method.id !== methodId));
}

function optimisticDefault(methods: PaymentMethod[], methodId: string) {
  return methods.map(method => ({ ...method, isDefault: method.id === methodId }));
}

function setPaymentReadCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  methods: PaymentMethod[],
) {
  queryClient.setQueryData(paymentKeys.methods(userId), methods);
  queryClient.setQueryData(paymentKeys.default(userId), methods.find(method => method.isDefault) ?? null);
}

async function invalidatePaymentReadCaches(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  await queryClient.invalidateQueries({ queryKey: paymentKeys.methods(userId) });
  await queryClient.invalidateQueries({ queryKey: paymentKeys.default(userId) });
  await queryClient.invalidateQueries({ queryKey: paymentKeys.billing(userId) });
}

function rollbackPaymentReadCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  context: PaymentMutationContext | undefined,
) {
  if (!context) return;
  queryClient.setQueryData(paymentKeys.methods(userId), context.previousMethods);
  queryClient.setQueryData(paymentKeys.default(userId), context.previousDefault);
  queryClient.setQueryData(paymentKeys.billing(userId), context.previousBilling);
}

async function snapshotPaymentReadCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
): Promise<PaymentMutationContext> {
  await queryClient.cancelQueries({ queryKey: paymentKeys.methods(userId) });
  await queryClient.cancelQueries({ queryKey: paymentKeys.default(userId) });
  await queryClient.cancelQueries({ queryKey: paymentKeys.billing(userId) });

  return {
    previousMethods: queryClient.getQueryData<PaymentMethod[]>(paymentKeys.methods(userId)) ?? [],
    previousDefault: queryClient.getQueryData<PaymentMethod | null>(paymentKeys.default(userId)),
    previousBilling: queryClient.getQueryData(paymentKeys.billing(userId)),
  };
}

export function usePaymentMethodsQuery(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  return usePolicyQuery(queryPolicies.paymentMethods, {
    queryKey: paymentKeys.methods(resolvedUserId),
    queryFn: async () => paymentsRepository.listPaymentMethods(),
  });
}

export function useDefaultPaymentMethodQuery(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  return usePolicyQuery(queryPolicies.paymentMethods, {
    queryKey: paymentKeys.default(resolvedUserId),
    queryFn: async () => paymentsRepository.getDefaultPaymentMethod(),
  });
}

export function useBillingProfileQuery(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  return usePolicyQuery(queryPolicies.paymentMethods, {
    queryKey: paymentKeys.billing(resolvedUserId),
    queryFn: async () => paymentsRepository.getBillingProfile(),
  });
}

export function useAddPaymentMethodMutation(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddPaymentMethodInput) => paymentsRepository.addPaymentMethod(input),
    onMutate: async input => {
      const context = await snapshotPaymentReadCaches(queryClient, resolvedUserId);
      setPaymentReadCaches(queryClient, resolvedUserId, optimisticAdd(context.previousMethods, input));
      return context;
    },
    onError: (_error, _input, context) => rollbackPaymentReadCaches(queryClient, resolvedUserId, context),
    onSettled: async () => invalidatePaymentReadCaches(queryClient, resolvedUserId),
  });
}

export function useUpdatePaymentMethodMutation(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePaymentMethodInput) => paymentsRepository.updatePaymentMethod(input),
    onMutate: async input => {
      const context = await snapshotPaymentReadCaches(queryClient, resolvedUserId);
      setPaymentReadCaches(queryClient, resolvedUserId, optimisticUpdate(context.previousMethods, input));
      return context;
    },
    onError: (_error, _input, context) => rollbackPaymentReadCaches(queryClient, resolvedUserId, context),
    onSettled: async () => invalidatePaymentReadCaches(queryClient, resolvedUserId),
  });
}

export function useDeletePaymentMethodMutation(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (methodId: string) => paymentsRepository.deletePaymentMethod(methodId),
    onMutate: async methodId => {
      const context = await snapshotPaymentReadCaches(queryClient, resolvedUserId);
      setPaymentReadCaches(queryClient, resolvedUserId, optimisticDelete(context.previousMethods, methodId));
      return context;
    },
    onError: (_error, _methodId, context) => rollbackPaymentReadCaches(queryClient, resolvedUserId, context),
    onSettled: async () => invalidatePaymentReadCaches(queryClient, resolvedUserId),
  });
}

export function useSetDefaultPaymentMethodMutation(userId?: string | null) {
  const resolvedUserId = resolveUserId(userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (methodId: string) => paymentsRepository.setDefaultPaymentMethod(methodId),
    onMutate: async methodId => {
      const context = await snapshotPaymentReadCaches(queryClient, resolvedUserId);
      setPaymentReadCaches(queryClient, resolvedUserId, optimisticDefault(context.previousMethods, methodId));
      return context;
    },
    onError: (_error, _methodId, context) => rollbackPaymentReadCaches(queryClient, resolvedUserId, context),
    onSettled: async () => invalidatePaymentReadCaches(queryClient, resolvedUserId),
  });
}
