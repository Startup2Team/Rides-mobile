export type PackagePaymentRepositoryMode = 'local' | 'shadow_remote' | 'remote';

export function normalizePackagePaymentRepositoryMode(
  value: unknown,
): PackagePaymentRepositoryMode | null {
  return value === 'local' || value === 'shadow_remote' || value === 'remote'
    ? value
    : null;
}

export function isPackagePaymentRepositoryMode(value: unknown): value is PackagePaymentRepositoryMode {
  return normalizePackagePaymentRepositoryMode(value) != null;
}
