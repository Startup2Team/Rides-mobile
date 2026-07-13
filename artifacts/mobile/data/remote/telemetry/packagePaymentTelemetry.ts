import { reportOperationalWarning } from '@/observability/monitoring';

type SafeTelemetryValue = string | number | boolean | undefined;

export interface PackagePaymentShadowTelemetry {
  operation: string;
  provider?: string;
  status?: string;
  result?: string;
  mismatchCategory?: string;
  latencyMs?: number;
  duplicateDetected?: boolean;
  proofAttached?: boolean;
  claimAgeMinutes?: number;
}

function compactTelemetry(context: PackagePaymentShadowTelemetry): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(context).filter((entry): entry is [string, Exclude<SafeTelemetryValue, undefined>] => entry[1] !== undefined),
  );
}

export function reportPackagePaymentShadowRequest(context: PackagePaymentShadowTelemetry) {
  reportOperationalWarning('package-payment.shadow.request', compactTelemetry(context));
}

export function reportPackagePaymentShadowSuccess(context: PackagePaymentShadowTelemetry) {
  reportOperationalWarning('package-payment.shadow.success', compactTelemetry(context));
}

export function reportPackagePaymentShadowFailure(context: PackagePaymentShadowTelemetry) {
  reportOperationalWarning('package-payment.shadow.failure', compactTelemetry(context));
}

export function reportPackagePaymentShadowMismatch(context: PackagePaymentShadowTelemetry) {
  reportOperationalWarning('package-payment.shadow.mismatch', compactTelemetry(context));
}
