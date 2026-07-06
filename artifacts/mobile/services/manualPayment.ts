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
export async function resolveManualPaymentInfo(): Promise<ResolvedManualPaymentInfo> {
  try {
    const info = await getManualPaymentInfo();
    const record = info as Record<string, unknown>;
    return {
      payCode:
        pickString(record.pay_code) ??
        pickString(record.payCode) ??
        MANUAL_PAYMENT_FALLBACK.payCode,
      phoneNumber:
        pickString(record.number) ??
        pickString(record.phone_number) ??
        pickString(record.phoneNumber) ??
        MANUAL_PAYMENT_FALLBACK.phoneNumber,
      instructions:
        pickString(record.instructions) ?? MANUAL_PAYMENT_FALLBACK.instructions,
    };
  } catch {
    return { ...MANUAL_PAYMENT_FALLBACK };
  }
}
