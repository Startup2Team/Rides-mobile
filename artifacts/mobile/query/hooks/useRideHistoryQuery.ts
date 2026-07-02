import { rideHistoryRepository } from '@/domains/ride';
import { resolveProjectedRideHistory } from '@/domains/ride/projection/historyCanary';
import { resolveProjectedRideDetail } from '@/domains/ride/projection/rideDetailCanary';
import { rideKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useRideHistoryQuery(userId?: string | null) {
  const resolvedUserId = userId ?? 'current';

  return usePolicyQuery(queryPolicies.rideHistory, {
    queryKey: rideKeys.history(resolvedUserId),
    queryFn: async () => {
      const liveHistory = await rideHistoryRepository.listRideHistory({ userId: resolvedUserId });
      return resolveProjectedRideHistory(liveHistory, resolvedUserId).history;
    },
  });
}

export function useRideDetailQuery(rideId: string | null | undefined) {
  return usePolicyQuery(queryPolicies.rideHistory, {
    queryKey: rideKeys.detail(rideId ?? 'unknown'),
    queryFn: async () => {
      if (!rideId) return null;
      const liveRide = await rideHistoryRepository.getRideDetail(rideId);
      return resolveProjectedRideDetail(liveRide, rideId).detail;
    },
    enabled: Boolean(rideId),
  });
}
