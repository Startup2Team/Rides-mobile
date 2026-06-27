import { authRepository } from '@/data/repositories';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useDriverProfileQuery() {
  return usePolicyQuery(queryPolicies.driverProfile, {
    queryKey: driverKeys.profile(),
    queryFn: async () => authRepository.getDriverProfile(),
  });
}
