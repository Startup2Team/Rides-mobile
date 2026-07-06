import { mapRepository } from '@/data/repositories';
import type { Coords } from '@/types';
import { searchKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useReverseGeocodeQuery(coords: Coords | null | undefined) {
  return usePolicyQuery(queryPolicies.reverseGeocode, {
    queryKey: coords ? searchKeys.reverseGeocode(coords) : ['search', 'reverse-geocode', 'idle'] as const,
    queryFn: async () => {
      if (!coords) return null;
      return mapRepository.reverseGeocode(coords);
    },
    enabled: Boolean(coords),
  });
}
