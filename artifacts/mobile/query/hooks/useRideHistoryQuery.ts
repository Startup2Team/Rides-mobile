import { rideRepository } from '@/data/repositories';
import { rideKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useRideHistoryQuery(userId: string | null | undefined) {
  return usePolicyQuery(queryPolicies.rideHistory, {
    queryKey: rideKeys.history(userId ?? 'current'),
    queryFn: async () => (await rideRepository.loadRideHistory()) ?? [],
  });
}
