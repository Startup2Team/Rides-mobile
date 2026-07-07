import { useEffect, useMemo, useRef } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useOptionalAuth } from '@/context/AuthContext';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';
import {
  getManualPaymentClaimPresentation,
  getManualPaymentClaimRefreshPolicy,
  toManualPaymentClaimReadModel,
  type ManualPaymentClaimAuthority,
  type ManualPaymentClaim,
  type ManualPaymentClaimReadModel,
} from '@/domains/package-payments';
import type {
  PackagePaymentFailure,
  PackagePaymentOutcome,
  PackagePaymentRepository,
} from '@/domains/package-payments';
import { reportOperationalWarning } from '@/observability/monitoring';
import { packagePaymentKeys, packagePaymentClaimsQueryPolicy } from '../keys/packagePaymentKeys';

export interface UseManualPaymentClaimsQueryOptions {
  repository?: PackagePaymentRepository;
  driverId?: string | null;
  enabled?: boolean;
  authority?: ManualPaymentClaimAuthority;
}

export interface ManualPaymentClaimsQueryResult {
  claims: ManualPaymentClaimReadModel[];
  nextCursor: string | null;
  failure: PackagePaymentFailure | null;
  error: PackagePaymentFailure | null;
  isLoading: boolean;
  isFetching: boolean;
  refreshPolicy: ReturnType<typeof getManualPaymentClaimRefreshPolicy>;
  refetch: UseQueryResult<PackagePaymentOutcome<unknown>>['refetch'];
}

function toRepositoryFailure(error: unknown): PackagePaymentFailure {
  return {
    code: 'repository_unavailable',
    message: error instanceof Error ? error.message : 'Package payment repository is unavailable.',
  };
}

export function useManualPaymentClaimsQuery(
  options: UseManualPaymentClaimsQueryOptions = {},
): ManualPaymentClaimsQueryResult {
  const auth = useOptionalAuth();
  const driverId = options.driverId ?? auth?.user?.id ?? null;
  const repository = options.repository ?? createPackagePaymentRepository();
  const enabled = (options.enabled ?? true) && Boolean(driverId);
  const query = useQuery<PackagePaymentOutcome<ManualPaymentClaim[]>>({
    queryKey: packagePaymentKeys.claimsList({ driverId }),
    queryFn: async () => {
      if (!driverId) {
        return { data: [], failure: null };
      }
      try {
        return await repository.listDriverManualPaymentClaims(driverId);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) };
      }
    },
    enabled,
    staleTime: packagePaymentClaimsQueryPolicy.staleTime,
    gcTime: packagePaymentClaimsQueryPolicy.gcTime,
    retry: packagePaymentClaimsQueryPolicy.retry,
    refetchOnWindowFocus: packagePaymentClaimsQueryPolicy.refetchOnWindowFocus,
    refetchOnReconnect: packagePaymentClaimsQueryPolicy.refetchOnReconnect,
  });

  const failure = query.data?.failure ?? null;
  const claims = useMemo(() => {
    const items = query.data?.data ?? [];
    return items.map(item => toManualPaymentClaimReadModel(item, {
      authority: options.authority ?? 'local_only_prototype',
    }));
  }, [options.authority, query.data]);
  const nextCursor = null;
  const refreshPolicy = claims.length > 0
    ? getManualPaymentClaimRefreshPolicy(claims[0].status)
    : getManualPaymentClaimRefreshPolicy('draft');
  const telemetrySignature = `${query.dataUpdatedAt}:${claims.length}:${nextCursor ?? 'none'}:${failure?.code ?? 'ok'}`;
  const lastTelemetrySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query.isFetched) return;
    if (lastTelemetrySignatureRef.current === telemetrySignature) return;
    lastTelemetrySignatureRef.current = telemetrySignature;

    reportOperationalWarning('package-payment.claims.loaded', {
      operation: 'useManualPaymentClaimsQuery',
      count: claims.length,
      failureCode: failure?.code,
      refreshIntervalMs: refreshPolicy.refetchInterval || 0,
    });

    if (failure) {
      reportOperationalWarning('package-payment.claims.failure', {
        operation: 'useManualPaymentClaimsQuery',
        failureCode: failure.code,
      });
    }
  }, [claims.length, failure, query.dataUpdatedAt, query.isFetched, refreshPolicy.refetchInterval, telemetrySignature]);

  return {
    claims,
    nextCursor,
    failure,
    error: failure,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refreshPolicy,
    refetch: query.refetch as ManualPaymentClaimsQueryResult['refetch'],
  };
}
