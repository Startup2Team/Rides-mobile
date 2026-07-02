import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';

export interface PaymentMethodDto {
  id: string;
  provider: string;
  label: string;
  phoneNumber?: string | null;
  isDefault: boolean;
}

export interface BillingProfileDto {
  defaultPaymentMethodId: string | null;
  mobileMoneyMethodIds: string[];
  cardMethodIds: string[];
  cashEnabled: boolean;
}

export interface ListPaymentMethodsResponseDto extends ApiEnvelope<{ items: PaymentMethodDto[] }> {}
export interface GetDefaultPaymentMethodResponseDto extends ApiEnvelope<PaymentMethodDto | null> {}
export interface GetBillingProfileResponseDto extends ApiEnvelope<BillingProfileDto> {}

export interface AddPaymentMethodRequestDto extends ApiIdempotencyMetadata {
  provider: string;
  label: string;
  phoneNumber?: string | null;
  isDefault?: boolean;
}

export interface UpdatePaymentMethodRequestDto extends ApiIdempotencyMetadata {
  methodId: string;
  label?: string | null;
  phoneNumber?: string | null;
  isDefault?: boolean | null;
}

export interface DeletePaymentMethodRequestDto extends ApiIdempotencyMetadata {
  methodId: string;
}

export interface SetDefaultPaymentMethodRequestDto extends ApiIdempotencyMetadata {
  methodId: string;
}

export interface AuthorizePaymentRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
}

export interface CapturePaymentRequestDto extends ApiIdempotencyMetadata {
  authorizationId: string;
}

export interface RefundPaymentRequestDto extends ApiIdempotencyMetadata {
  captureId: string;
  amount?: number | null;
}

export interface PaymentErrorDto extends ApiErrorDto {}

export interface PaymentApiContract {
  listPaymentMethods: undefined;
  getDefaultPaymentMethod: undefined;
  getBillingProfile: undefined;
  addPaymentMethod: AddPaymentMethodRequestDto;
  updatePaymentMethod: UpdatePaymentMethodRequestDto;
  deletePaymentMethod: DeletePaymentMethodRequestDto;
  setDefaultPaymentMethod: SetDefaultPaymentMethodRequestDto;
  authorizePayment: AuthorizePaymentRequestDto;
  capturePayment: CapturePaymentRequestDto;
  refundPayment: RefundPaymentRequestDto;
}

export const AddPaymentMethodRequestDto = {} as AddPaymentMethodRequestDto;
