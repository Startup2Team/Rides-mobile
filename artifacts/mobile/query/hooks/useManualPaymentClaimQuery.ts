import { useEffect, useMemo, useRef } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
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

export interface UseManualPaymentClaimQueryOptions {
  repository?: PackagePaymentRepository;
  enabled?: boolean;
  authority?: ManualPaymentClaimAuthority;
}

export interface ManualPaymentClaimQueryResult {
  claim: ManualPaymentClaimReadModel | null;
  presentation: ReturnType<typeof getManualPaymentClaimPresentation> | null;
  refreshPolicy: ReturnType<typeof getManualPaymentClaimRefreshPolicy>;
  failure: PackagePaymentFailure | null;
  error: PackagePaymentFailure | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: UseQueryResult<PackagePaymentOutcome<unknown>>['refetch'];
}

function toRepositoryFailure(error: unknown): PackagePaymentFailure {
  return {
    code: 'repository_unavailable',
    message: error instanceof Error ? error.message : 'Package payment repository is unavailable.',
  };
}

export function useManualPaymentClaimQuery(
  claimId: string | null | undefined,
  options: UseManualPaymentClaimQueryOptions = {},
): ManualPaymentClaimQueryResult {
  const repository = options.repository ?? createPackagePaymentRepository();
  const query = useQuery<PackagePaymentOutcome<ManualPaymentClaim>>({
    queryKey: claimId ? packagePaymentKeys.claim(claimId) : packagePaymentKeys.claim('missing'),
    queryFn: async () => {
      if (!claimId) {
        return { data: null, failure: { code: 'claim_not_found', message: 'Manual payment claim was not found.' } };
      }
      try {
        return await repository.getManualPaymentClaim(claimId);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) };
      }
    },
    enabled: (options.enabled ?? true) && Boolean(claimId),
    staleTime: packagePaymentClaimsQueryPolicy.staleTime,
    gcTime: packagePaymentClaimsQueryPolicy.gcTime,
    retry: packagePaymentClaimsQueryPolicy.retry,
    refetchOnWindowFocus: packagePaymentClaimsQueryPolicy.refetchOnWindowFocus,
    refetchOnReconnect: packagePaymentClaimsQueryPolicy.refetchOnReconnect,
    refetchInterval: currentQuery => {
      const claim = currentQuery.state.data?.data ?? null;
      if (!claim) return false;
      return getManualPaymentClaimRefreshPolicy(claim.status).refetchInterval;
    },
  });

  const failure = query.data?.failure ?? null;
  const claim = query.data?.data
    ? toManualPaymentClaimReadModel(query.data.data, { authority: options.authority ?? 'local_only_prototype' })
    : null;
  const presentation = claim ? getManualPaymentClaimPresentation(claim.status) : null;
  const refreshPolicy = claim ? getManualPaymentClaimRefreshPolicy(claim.status) : getManualPaymentClaimRefreshPolicy('draft');
  const telemetrySignature = `${query.dataUpdatedAt}:${claim?.status ?? 'none'}:${failure?.code ?? 'ok'}`;
  const lastTelemetrySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query.isFetched) return;
    if (lastTelemetrySignatureRef.current === telemetrySignature) return;
    lastTelemetrySignatureRef.current = telemetrySignature;

    reportOperationalWarning('package-payment.claim.loaded', {
      operation: 'useManualPaymentClaimQuery',
      status: claim?.status ?? 'missing',
      failureCode: failure?.code,
      refetchIntervalMs: refreshPolicy.refetchInterval || 0,
    });

    if (failure) {
      reportOperationalWarning('package-payment.claim.failure', {
        operation: 'useManualPaymentClaimQuery',
        failureCode: failure.code,
      });
    }
  }, [claim?.status, failure, query.dataUpdatedAt, query.isFetched, refreshPolicy.refetchInterval, telemetrySignature]);

  return {
    claim,
    presentation,
    refreshPolicy,
    failure,
    error: failure,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch as ManualPaymentClaimQueryResult['refetch'],
  };
}
