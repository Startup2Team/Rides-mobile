import {
  DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION,
  InMemoryPackagePaymentRepository,
  type PackagePaymentConfiguration,
  type PackagePaymentRepository,
} from '@/domains/package-payments';
import { createPackagePaymentShadowRepository } from '@/data/remote/repositories/packagePaymentShadowRepository';

export interface PackagePaymentRepositoryFactoryOptions {
  configuration?: PackagePaymentConfiguration | null;
  remoteRepository?: PackagePaymentRepository;
  enableRemoteDiagnostics?: boolean;
}

export function createPackagePaymentRepository(
  options: PackagePaymentRepositoryFactoryOptions = {},
): PackagePaymentRepository {
  const localRepository = new InMemoryPackagePaymentRepository(
    options.configuration ?? DEFAULT_SAFE_PACKAGE_PAYMENT_CONFIGURATION,
  );

  if (options.enableRemoteDiagnostics && options.remoteRepository) {
    return createPackagePaymentShadowRepository({
      localRepository,
      remoteRepository: options.remoteRepository,
    });
  }

  return localRepository;
}
