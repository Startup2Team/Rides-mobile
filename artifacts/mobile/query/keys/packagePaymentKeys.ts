import type { QueryClient } from '@tanstack/react-query';
import type { ManualPaymentClaimStatus } from '@/domains/package-payments';

export interface PackagePaymentClaimsListKeyFilters {
  driverId?: string | null;
  cursor?: string | null;
  limit?: number | null;
}

export const packagePaymentKeys = {
  all: ['package-payments'] as const,
  configuration: () => [...packagePaymentKeys.all, 'configuration'] as const,
  claims: () => [...packagePaymentKeys.all, 'claims'] as const,
  claimsList: (filters: PackagePaymentClaimsListKeyFilters = {}) => [...packagePaymentKeys.claims(), 'list', filters] as const,
  claim: (claimId: string) => [...packagePaymentKeys.claims(), 'detail', claimId] as const,
};

export const packagePaymentConfigurationQueryPolicy = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: false,
} as const;

export const packagePaymentClaimsQueryPolicy = {
  staleTime: 20_000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: false,
} as const;

export function getManualPaymentClaimRefreshPolicy(status: ManualPaymentClaimStatus) {
  return {
    draft: { staleTime: 5 * 60 * 1000, refetchInterval: false as const, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false as const },
    submitted: { staleTime: 20_000, refetchInterval: 45_000, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false as const },
    pending_review: { staleTime: 20_000, refetchInterval: 45_000, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false as const },
    needs_clarification: { staleTime: 60_000, refetchInterval: false as const, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false as const },
    approved: { staleTime: 10 * 60 * 1000, refetchInterval: false as const, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false as const },
    rejected: { staleTime: 10 * 60 * 1000, refetchInterval: false as const, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false as const },
    expired: { staleTime: 10 * 60 * 1000, refetchInterval: false as const, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false as const },
    cancelled: { staleTime: 10 * 60 * 1000, refetchInterval: false as const, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false as const },
  }[status];
}

export function invalidatePackagePaymentConfiguration(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: packagePaymentKeys.configuration() });
}

export function invalidatePackagePaymentClaims(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: packagePaymentKeys.claims() });
}

export function invalidatePackagePaymentClaim(queryClient: QueryClient, claimId: string) {
  return queryClient.invalidateQueries({ queryKey: packagePaymentKeys.claim(claimId) });
}
