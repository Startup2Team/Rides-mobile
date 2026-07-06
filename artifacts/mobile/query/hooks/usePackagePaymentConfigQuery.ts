import { useEffect, useRef } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';
import { getSafePackagePaymentConfiguration, validatePackagePaymentConfiguration } from '@/domains/package-payments';
import type {
  PackagePaymentConfiguration,
  PackagePaymentFailure,
  PackagePaymentOutcome,
  PackagePaymentRepository,
} from '@/domains/package-payments';
import { reportOperationalWarning } from '@/observability/monitoring';
import { packagePaymentConfigurationQueryPolicy, packagePaymentKeys } from '../keys/packagePaymentKeys';

export interface UsePackagePaymentConfigQueryOptions {
  repository?: PackagePaymentRepository;
  enabled?: boolean;
}

export interface PackagePaymentConfigQueryResult {
  configuration: PackagePaymentConfiguration;
  fallbackConfiguration: PackagePaymentConfiguration;
  rawConfiguration: PackagePaymentConfiguration | null;
  failure: PackagePaymentFailure | null;
  error: PackagePaymentFailure | null;
  isFallbackUsed: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: UseQueryResult<PackagePaymentOutcome<PackagePaymentConfiguration>>['refetch'];
}

function toRepositoryFailure(error: unknown): PackagePaymentFailure {
  return {
    code: 'repository_unavailable',
    message: error instanceof Error ? error.message : 'Package payment repository is unavailable.',
  };
}

function isValidPackagePaymentConfiguration(configuration: PackagePaymentConfiguration | null | undefined) {
  if (!configuration) return false;
  return Boolean(validatePackagePaymentConfiguration(configuration).data);
}

export function usePackagePaymentConfigQuery(
  options: UsePackagePaymentConfigQueryOptions = {},
): PackagePaymentConfigQueryResult {
  const repository = options.repository ?? createPackagePaymentRepository();
  const query = useQuery({
    queryKey: packagePaymentKeys.configuration(),
    queryFn: async (): Promise<PackagePaymentOutcome<PackagePaymentConfiguration>> => {
      try {
        return await repository.getPaymentConfiguration();
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) };
      }
    },
    enabled: options.enabled ?? true,
    staleTime: packagePaymentConfigurationQueryPolicy.staleTime,
    gcTime: packagePaymentConfigurationQueryPolicy.gcTime,
    retry: packagePaymentConfigurationQueryPolicy.retry,
    refetchOnWindowFocus: packagePaymentConfigurationQueryPolicy.refetchOnWindowFocus,
    refetchOnReconnect: packagePaymentConfigurationQueryPolicy.refetchOnReconnect,
  });

  const rawConfiguration = query.data?.data ?? null;
  const failure = query.data?.failure ?? null;
  const fallbackConfiguration = getSafePackagePaymentConfiguration(null);
  const configuration = getSafePackagePaymentConfiguration(query.data ?? null, fallbackConfiguration);
  const isFallbackUsed = Boolean(failure) || !isValidPackagePaymentConfiguration(rawConfiguration);
  const telemetrySignature = `${query.dataUpdatedAt}:${configuration.mode}:${failure?.code ?? 'ok'}:${isFallbackUsed ? 'fallback' : 'resolved'}`;
  const lastTelemetrySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query.isFetched) return;
    if (lastTelemetrySignatureRef.current === telemetrySignature) return;
    lastTelemetrySignatureRef.current = telemetrySignature;

    reportOperationalWarning('package-payment.config.loaded', {
      operation: 'usePackagePaymentConfigQuery',
      mode: configuration.mode,
      fallbackUsed: isFallbackUsed,
      failureCode: failure?.code,
    });

    reportOperationalWarning('package-payment.config.mode', {
      operation: 'usePackagePaymentConfigQuery',
      mode: configuration.mode,
    });

    if (isFallbackUsed) {
      reportOperationalWarning('package-payment.config.fallback', {
        operation: 'usePackagePaymentConfigQuery',
        mode: configuration.mode,
        reason: failure?.code ?? 'malformed',
      });
    }

    if (failure) {
      reportOperationalWarning('package-payment.config.failure', {
        operation: 'usePackagePaymentConfigQuery',
        failureCode: failure.code,
      });
    }
  }, [configuration.mode, failure, isFallbackUsed, query.dataUpdatedAt, query.isFetched, telemetrySignature]);

  return {
    configuration,
    fallbackConfiguration,
    rawConfiguration,
    failure,
    error: failure,
    isFallbackUsed,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
