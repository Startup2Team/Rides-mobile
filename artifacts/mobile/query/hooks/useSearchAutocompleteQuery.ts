import { searchRepository } from '@/data/repositories';
import type { Coords } from '@/types';
import { searchKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useSearchAutocompleteQuery(query: string, options?: { near?: Coords; limit?: number }) {
  return usePolicyQuery(queryPolicies.searchAutocomplete, {
    queryKey: searchKeys.autocomplete(query, options?.near),
    queryFn: async () => searchRepository.search(query, options),
    enabled: query.trim().length > 0,
  });
}
