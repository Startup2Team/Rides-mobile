import { useAuth } from '@/context/AuthContext';
import { fetchLocationSuggestions } from '@/services/locations';
import { locationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Personalised place suggestions (GET /locations/suggestions): saved places,
// explicit recents, destinations derived from completed rides, and the landmark
// list, in one authenticated round trip. Signed-out riders get nothing, so the
// query only runs for a signed-in user.
export function useLocationSuggestionsQuery(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();

  return usePolicyQuery(queryPolicies.locationSuggestions, {
    queryKey: locationKeys.suggestions(),
    queryFn: () => fetchLocationSuggestions(),
    enabled: !!user && (options.enabled ?? true),
  });
}
