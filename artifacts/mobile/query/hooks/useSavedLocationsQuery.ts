import { savedLocationsRepository } from '@/data/repositories';
import { savedLocationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useSavedLocationsQuery(userId: string | null | undefined) {
  return usePolicyQuery(queryPolicies.savedLocations, {
    queryKey: savedLocationKeys.list(userId ?? 'current'),
    queryFn: async () => savedLocationsRepository.listSavedLocations(),
  });
}
