import { getMyRatings, summarizeRatings, type RatingSummary } from '@/services/rating';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

const EMPTY_SUMMARY: RatingSummary = { averageRating: null, ratingCount: 0 };

// The signed-in driver's real received ratings (GET /v1/users/me/ratings),
// aggregated into an average + count. Replaces the local SecureStorage source
// used across the driver dashboard, stats, and profile screens.
export function useDriverRatingsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<RatingSummary>(queryPolicies.driverRatings, {
    queryKey: driverKeys.ratings(),
    queryFn: async () => summarizeRatings(await getMyRatings()),
    enabled: options?.enabled ?? true,
    placeholderData: EMPTY_SUMMARY,
  });
}
