import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import type { PaymentMethod } from '@/types';
import type { AddPaymentMethodInput, BillingProfile, UpdatePaymentMethodInput } from '@/domains/payments/types';

// Real-backend customer payment methods under /api/v1/payments/methods.
// Snake_case wire format, matching the rest of the API and the contract in
// Rides-api/docs/backend/MOBILE_PAYMENT_CONTRACTS.md. These endpoints do not
// exist on the backend yet; this module is ready to switch on the moment they
// ship (see domains/payments/repository.ts source resolver).

interface PaymentMethodDto {
  id: string;
  provider: string;
  label: string;
  phone_number?: string | null;
  is_default: boolean;
}

interface BillingProfileDto {
  default_payment_method_id: string | null;
  mobile_money_method_ids: string[];
  card_method_ids: string[];
  cash_enabled: boolean;
}

interface Envelope<T> {
  data: T;
}

interface MutationDto {
  items?: PaymentMethodDto[];
  method?: PaymentMethodDto | null;
}

function toMethod(dto: PaymentMethodDto): PaymentMethod {
  return {
    id: dto.id,
    provider: dto.provider as PaymentMethod['provider'],
    label: dto.label,
    phoneNumber: dto.phone_number ?? undefined,
    isDefault: dto.is_default,
  };
}

function toBillingProfile(dto: BillingProfileDto, methods: PaymentMethod[]): BillingProfile {
  const defaultMethod = methods.find(m => m.id === dto.default_payment_method_id) ?? null;
  return {
    defaultPaymentMethodId: dto.default_payment_method_id,
    mobileMoneyMethodIds: dto.mobile_money_method_ids,
    cardMethodIds: dto.card_method_ids,
    cashEnabled: dto.cash_enabled,
    preferences: {
      preferCash: defaultMethod?.provider === 'cash',
      preferMobileMoney: defaultMethod?.provider === 'mtn' || defaultMethod?.provider === 'airtel',
    },
  };
}

// Dedupe guard for the backend so retries/double-taps don't create duplicates.
let idemCounter = 0;
function idempotencyKey(prefix: string): string {
  idemCounter += 1;
  return `${prefix}-${Date.now()}-${idemCounter}`;
}

const client = () => getAppBackendClient();

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await client().get<Envelope<{ items: PaymentMethodDto[] }>>('/v1/payments/methods');
  return (res.data.data.items ?? []).map(toMethod);
}

export async function getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
  const res = await client().get<Envelope<PaymentMethodDto | null>>('/v1/payments/methods/default');
  return res.data.data ? toMethod(res.data.data) : null;
}

export async function getBillingProfile(): Promise<BillingProfile> {
  const [profileRes, methods] = await Promise.all([
    client().get<Envelope<BillingProfileDto>>('/v1/payments/billing-profile'),
    listPaymentMethods(),
  ]);
  return toBillingProfile(profileRes.data.data, methods);
}

// Mutations return the full updated list so the UI can render immediately.
// If the backend echoes items we use them; otherwise we re-list.
async function methodsFromMutation(dto: MutationDto): Promise<PaymentMethod[]> {
  if (dto.items) return dto.items.map(toMethod);
  return listPaymentMethods();
}

export async function addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod[]> {
  const res = await client().post<Envelope<MutationDto>>('/v1/payments/methods', {
    body: {
      provider: input.provider,
      label: input.label,
      phone_number: input.phoneNumber ?? null,
      is_default: input.isDefault ?? false,
      idempotency_key: idempotencyKey('add-method'),
    },
  });
  return methodsFromMutation(res.data.data);
}

export async function updatePaymentMethod({ methodId, updates }: UpdatePaymentMethodInput): Promise<PaymentMethod[]> {
  const body: Record<string, unknown> = { idempotency_key: idempotencyKey('update-method') };
  if (updates.label !== undefined) body.label = updates.label;
  if (updates.phoneNumber !== undefined) body.phone_number = updates.phoneNumber ?? null;
  if (updates.isDefault !== undefined) body.is_default = updates.isDefault;
  const res = await client().patch<Envelope<MutationDto>>(`/v1/payments/methods/${methodId}`, { body });
  return methodsFromMutation(res.data.data);
}

export async function deletePaymentMethod(methodId: string): Promise<PaymentMethod[]> {
  const res = await client().delete<Envelope<MutationDto>>(`/v1/payments/methods/${methodId}`, {
    body: { idempotency_key: idempotencyKey('delete-method') },
  });
  return methodsFromMutation(res.data.data);
}

export async function setDefaultPaymentMethod(methodId: string): Promise<PaymentMethod[]> {
  const res = await client().patch<Envelope<MutationDto>>(`/v1/payments/methods/${methodId}/default`, {
    body: { idempotency_key: idempotencyKey('default-method') },
  });
  return methodsFromMutation(res.data.data);
}
