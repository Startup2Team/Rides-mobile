import { paymentRepository as localPaymentRepository } from '@/data/repositories';
import type { AddPaymentMethodInput, BillingProfile, PaymentMethod, UpdatePaymentMethodInput } from './types';
import * as backendPaymentMethods from '@/services/paymentMethods';

const DEFAULT_CASH_METHOD: PaymentMethod = {
  id: 'cash_default',
  provider: 'cash',
  label: 'Pay with Cash',
  isDefault: true,
};

async function listMethodsWithDefault(): Promise<PaymentMethod[]> {
  const methods = await localPaymentRepository.listPaymentMethods();
  return methods.length > 0 ? methods : [DEFAULT_CASH_METHOD];
}

function normalizeDefault(methods: PaymentMethod[]): PaymentMethod[] {
  const firstDefault = methods.find(method => method.isDefault);
  if (firstDefault) {
    return methods.map(method => ({ ...method, isDefault: method.id === firstDefault.id }));
  }
  if (methods.length === 0) return methods;
  return methods.map((method, index) => ({ ...method, isDefault: index === 0 }));
}

function buildBillingProfile(methods: PaymentMethod[]): BillingProfile {
  const normalized = normalizeDefault(methods);
  const defaultMethod = normalized.find(method => method.isDefault) ?? null;
  const mobileMoneyMethods = normalized.filter(method => method.provider === 'mtn' || method.provider === 'airtel');

  return {
    defaultPaymentMethodId: defaultMethod?.id ?? null,
    mobileMoneyMethodIds: mobileMoneyMethods.map(method => method.id),
    cardMethodIds: [],
    cashEnabled: normalized.some(method => method.provider === 'cash'),
    preferences: {
      preferCash: defaultMethod?.provider === 'cash',
      preferMobileMoney: defaultMethod?.provider === 'mtn' || defaultMethod?.provider === 'airtel',
    },
  };
}

export interface PaymentsRepository {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  getDefaultPaymentMethod(): Promise<PaymentMethod | null>;
  getBillingProfile(): Promise<BillingProfile>;
  addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod[]>;
  updatePaymentMethod(input: UpdatePaymentMethodInput): Promise<PaymentMethod[]>;
  deletePaymentMethod(methodId: string): Promise<PaymentMethod[]>;
  setDefaultPaymentMethod(methodId: string): Promise<PaymentMethod[]>;
}

const localPaymentsRepository: PaymentsRepository = {
  async listPaymentMethods(): Promise<PaymentMethod[]> {
    return normalizeDefault(await listMethodsWithDefault());
  },

  async getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
    const methods = await listMethodsWithDefault();
    return normalizeDefault(methods).find(method => method.isDefault) ?? null;
  },

  async getBillingProfile(): Promise<BillingProfile> {
    return buildBillingProfile(await listMethodsWithDefault());
  },

  async addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod[]> {
    const methods = await listMethodsWithDefault();
    const nextMethod: PaymentMethod = {
      id: input.id,
      provider: input.provider,
      label: input.label,
      phoneNumber: input.phoneNumber,
      isDefault: input.isDefault ?? methods.length === 0,
    };
    const next = normalizeDefault([
      ...methods.map(method => nextMethod.isDefault ? { ...method, isDefault: false } : method),
      nextMethod,
    ]);
    await localPaymentRepository.savePaymentMethods(next);
    return next;
  },

  async updatePaymentMethod({ methodId, updates }: UpdatePaymentMethodInput): Promise<PaymentMethod[]> {
    const methods = await listMethodsWithDefault();
    const next = normalizeDefault(methods.map(method => (
      method.id === methodId
        ? { ...method, ...updates, id: method.id, provider: method.provider }
        : updates.isDefault === true
          ? { ...method, isDefault: false }
          : method
    )));
    await localPaymentRepository.savePaymentMethods(next);
    return next;
  },

  async deletePaymentMethod(methodId: string): Promise<PaymentMethod[]> {
    const methods = await listMethodsWithDefault();
    const next = normalizeDefault(methods.filter(method => method.id !== methodId));
    await localPaymentRepository.savePaymentMethods(next);
    return next;
  },

  async setDefaultPaymentMethod(methodId: string): Promise<PaymentMethod[]> {
    const methods = await listMethodsWithDefault();
    const next = methods.map(method => ({ ...method, isDefault: method.id === methodId }));
    await localPaymentRepository.savePaymentMethods(next);
    return next;
  },
};

// Real backend (GET/POST/PATCH/DELETE /payments/methods). The server owns
// default/normalization, but we still guarantee a cash fallback and a single
// default so the UI contract is identical to local.
const backendPaymentsRepository: PaymentsRepository = {
  async listPaymentMethods() {
    const methods = await backendPaymentMethods.listPaymentMethods();
    return normalizeDefault(methods.length > 0 ? methods : [DEFAULT_CASH_METHOD]);
  },
  async getDefaultPaymentMethod() {
    return backendPaymentMethods.getDefaultPaymentMethod();
  },
  async getBillingProfile() {
    return backendPaymentMethods.getBillingProfile();
  },
  async addPaymentMethod(input) {
    return normalizeDefault(await backendPaymentMethods.addPaymentMethod(input));
  },
  async updatePaymentMethod(input) {
    return normalizeDefault(await backendPaymentMethods.updatePaymentMethod(input));
  },
  async deletePaymentMethod(methodId) {
    return normalizeDefault(await backendPaymentMethods.deletePaymentMethod(methodId));
  },
  async setDefaultPaymentMethod(methodId) {
    return normalizeDefault(await backendPaymentMethods.setDefaultPaymentMethod(methodId));
  },
};

// Source switch: defaults to the REAL BACKEND now that the payment-methods
// endpoints are built + verified. Set EXPO_PUBLIC_PAYMENT_METHODS_SOURCE=local
// to fall back to the on-device store (offline/dev only).
function resolvePaymentsRepository(): PaymentsRepository {
  return process.env.EXPO_PUBLIC_PAYMENT_METHODS_SOURCE === 'local'
    ? localPaymentsRepository
    : backendPaymentsRepository;
}

export const paymentsRepository: PaymentsRepository = resolvePaymentsRepository();

export {
  RemotePaymentRepository,
  createPaymentShadowRepository,
  createRemotePaymentRepositoryPrototype,
} from '@/data/remote/repositories/RemotePaymentRepository';
