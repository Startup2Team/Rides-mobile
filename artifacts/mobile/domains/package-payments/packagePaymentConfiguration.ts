import { validatePackagePaymentConfiguration } from './manualPaymentClaimValidator';
import type { PackagePaymentConfiguration, PackagePaymentOutcome } from './types';

export const DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION: PackagePaymentConfiguration = {
  mode: 'automatic',
  version: 'fallback-automatic',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function extractConfiguration(
  value: PackagePaymentConfiguration | PackagePaymentOutcome<PackagePaymentConfiguration> | null | undefined,
) {
  if (!value) return null;
  if (typeof value === 'object' && 'data' in value) return value.data;
  return value;
}

export function getSafePackagePaymentConfiguration(
  value: PackagePaymentConfiguration | PackagePaymentOutcome<PackagePaymentConfiguration> | null | undefined,
  fallback: PackagePaymentConfiguration = DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION,
): PackagePaymentConfiguration {
  const configuration = extractConfiguration(value);
  const validation = validatePackagePaymentConfiguration(configuration);
  if (validation.data) return validation.data;
  return fallback;
}
