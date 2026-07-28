import { getManualPaymentInfo } from '@/services/driverPackages';
import { MANUAL_PAYMENT_FALLBACK } from '@/constants/manualPayment';

export interface ResolvedManualPaymentInfo {
  payCode: string;
  phoneNumber: string;
  instructions: string;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// Resolve where/how to pay manually: prefer live backend config, fall back to
// the bundled details so the flow always works even before the API is wired.
// The backend exposes a merchant MoMo code (payCode) + name + instructions; it
// does NOT return a separate "send-money" phone number, so phoneNumber always
// comes from the bundled fallback. When the merchant code is unconfigured
// (enabled === false / empty payCode) we also fall back.
export async function resolveManualPaymentInfo(): Promise<ResolvedManualPaymentInfo> {
  try {
    const info = await getManualPaymentInfo();
    return {
      payCode: pickString(info.payCode) ?? MANUAL_PAYMENT_FALLBACK.payCode,
      phoneNumber: MANUAL_PAYMENT_FALLBACK.phoneNumber,
      instructions: pickString(info.instructions) ?? MANUAL_PAYMENT_FALLBACK.instructions,
    };
  } catch {
    return { ...MANUAL_PAYMENT_FALLBACK };
  }
}
