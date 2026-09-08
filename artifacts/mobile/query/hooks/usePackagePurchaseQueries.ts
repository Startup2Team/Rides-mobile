import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { getPurchaseStatus, purchasePackage, type PurchasePackageInput, type RemotePackagePurchase } from '@/services/driverPackages';
import { reportOperationalWarning } from '@/observability/monitoring';
import { driverKeys } from '../keys/driverKeys';
import { packageKeys } from '../keys';

// Automatic MoMo package purchase (POST /driver/packages/purchase → a PENDING
// MoMo charge the driver approves with their PIN; GET .../purchases/{id} polls
// it to a terminal PAID/FAILED). This is the REAL backend purchase path —
// distinct from the client-only entitlement simulation in
// domain/driverRidePackages (used for the free launch package today) and from
// the manual proof-based claim in domains/package-payments.

export function usePurchasePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchasePackageInput) => purchasePackage(input),
    onSuccess: purchase => {
      // Seed the status-poll cache so the very first status render (before the
      // poll query's own fetch lands) already shows the just-created purchase.
      queryClient.setQueryData(packageKeys.purchaseStatus(purchase.id), purchase);
      // A purchase can settle PAID synchronously on creation (free/promotional
      // grant, or an idempotent replay of an already-settled attempt) without
      // the status-poll query ever running — invalidate entitlements here too
      // so that path also reflects the grant immediately.
      if (purchase.status === 'PAID') {
        void queryClient.invalidateQueries({ queryKey: driverKeys.entitlements() });
      }
      reportOperationalWarning('package-payment.automatic.purchase.create', {
        operation: 'usePurchasePackageMutation',
        result: purchase.status,
      });
    },
    onError: () => {
      reportOperationalWarning('package-payment.automatic.purchase.create', {
        operation: 'usePurchasePackageMutation',
        result: 'exception',
      });
    },
  });
}

const PURCHASE_STATUS_POLL_MS = 4000;

export interface UsePackagePurchaseStatusQueryOptions {
  /** Set false to pause polling (e.g. once the caller gives up after a timeout). */
  enabled?: boolean;
}

// Polls a purchase until it settles. `refetchInterval` reads the LAST FETCHED
// status (not component state) so it keeps polling across re-renders and stops
// itself the instant a terminal status lands — mirrors
// useManualPaymentClaimQuery's refetchInterval-by-status pattern.
export function usePackagePurchaseStatusQuery(
  purchaseId: string | null | undefined,
  options: UsePackagePurchaseStatusQueryOptions = {},
): UseQueryResult<RemotePackagePurchase> {
  const query = useQuery({
    queryKey: packageKeys.purchaseStatus(purchaseId ?? 'missing'),
    queryFn: () => getPurchaseStatus(purchaseId as string),
    enabled: (options.enabled ?? true) && Boolean(purchaseId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: currentQuery => {
      const status = currentQuery.state.data?.status;
      if (status === 'PAID' || status === 'FAILED') return false;
      return PURCHASE_STATUS_POLL_MS;
    },
  });

  const queryClient = useQueryClient();
  const telemetrySignature = `${purchaseId ?? 'none'}:${query.dataUpdatedAt}:${query.data?.status ?? 'none'}`;
  const lastTelemetrySignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!query.isFetched || !purchaseId) return;
    if (lastTelemetrySignatureRef.current === telemetrySignature) return;
    lastTelemetrySignatureRef.current = telemetrySignature;
    reportOperationalWarning('package-payment.automatic.purchase.status', {
      operation: 'usePackagePurchaseStatusQuery',
      status: query.data?.status ?? 'unknown',
    });
    // The driver home screen gates "go online" on the backend-authoritative
    // ride-credit entitlements — invalidate them the instant a purchase settles
    // PAID so a fresh grant shows up immediately, not on that query's own
    // staleTime/focus refetch.
    if (query.data?.status === 'PAID') {
      void queryClient.invalidateQueries({ queryKey: driverKeys.entitlements() });
    }
  }, [purchaseId, query.data?.status, query.dataUpdatedAt, query.isFetched, queryClient, telemetrySignature]);

  return query;
}
