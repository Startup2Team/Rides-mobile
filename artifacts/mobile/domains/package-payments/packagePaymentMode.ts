import type { PackagePaymentMode, PackagePaymentModePolicy } from './types';

const PACKAGE_PAYMENT_MODES: PackagePaymentMode[] = ['automatic', 'manual', 'disabled'];

export function normalizePackagePaymentMode(value: unknown): PackagePaymentMode | null {
  return typeof value === 'string' && (PACKAGE_PAYMENT_MODES as readonly string[]).includes(value)
    ? (value as PackagePaymentMode)
    : null;
}

export function isPackagePaymentMode(value: unknown): value is PackagePaymentMode {
  return normalizePackagePaymentMode(value) != null;
}

export function getPackagePaymentModePolicy(mode: unknown): PackagePaymentModePolicy {
  const normalized = normalizePackagePaymentMode(mode) ?? 'disabled';
  return {
    mode: normalized,
    automaticAllowed: normalized === 'automatic',
    manualAllowed: normalized === 'manual',
    initiationAllowed: normalized !== 'disabled',
  };
}

export function canInitiatePackagePayment(mode: unknown) {
  return getPackagePaymentModePolicy(mode).initiationAllowed;
}

export function canUseAutomaticPackagePayment(mode: unknown) {
  return getPackagePaymentModePolicy(mode).automaticAllowed;
}

export function canUseManualPackagePayment(mode: unknown) {
  return getPackagePaymentModePolicy(mode).manualAllowed;
}

export function assertPackagePaymentMode(mode: unknown): PackagePaymentMode | null {
  return normalizePackagePaymentMode(mode);
}
