import type { PaymentMethod, PaymentProvider } from '@/types';

export type { PaymentMethod, PaymentProvider };

export interface BillingProfile {
  defaultPaymentMethodId: string | null;
  mobileMoneyMethodIds: string[];
  cardMethodIds: string[];
  cashEnabled: boolean;
  preferences: {
    preferCash: boolean;
    preferMobileMoney: boolean;
  };
}

export interface AddPaymentMethodInput {
  id: string;
  provider: PaymentProvider;
  label: string;
  phoneNumber?: string;
  isDefault?: boolean;
}

export interface UpdatePaymentMethodInput {
  methodId: string;
  updates: Partial<Pick<PaymentMethod, 'label' | 'phoneNumber' | 'isDefault'>>;
}
