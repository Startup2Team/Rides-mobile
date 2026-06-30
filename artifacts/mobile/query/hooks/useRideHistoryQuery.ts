import { rideHistoryRepository } from '@/domains/ride';
import { rideKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useRideHistoryQuery(userId?: string | null) {
  const resolvedUserId = userId ?? 'current';

  return usePolicyQuery(queryPolicies.rideHistory, {
    queryKey: rideKeys.history(resolvedUserId),
    queryFn: async () => rideHistoryRepository.listRideHistory({ userId: resolvedUserId }),
  });
}

export function useRideDetailQuery(rideId: string | null | undefined) {
  return usePolicyQuery(queryPolicies.rideHistory, {
    queryKey: rideKeys.detail(rideId ?? 'unknown'),
    queryFn: async () => rideId ? rideHistoryRepository.getRideDetail(rideId) : null,
    enabled: Boolean(rideId),
  });
}
