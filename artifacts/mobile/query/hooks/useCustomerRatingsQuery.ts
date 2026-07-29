import {
  getMyRatings,
  summarizeRatings,
  type RatingSummary,
} from "@/services/rating";
import { customerRatingKeys } from "../keys";
import { queryPolicies } from "../policies";
import { usePolicyQuery } from "./shared";

const EMPTY_SUMMARY: RatingSummary = {
  averageRating: null,
  ratingCount: 0,
};

// Backend contract: GET /v1/users/me/ratings returns ratings received by the
// signed-in user. Keeping a customer-specific cache key prevents customer and
// driver mode data from sharing cached summaries.
export function useCustomerRatingsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<RatingSummary>(queryPolicies.customerRatings, {
    queryKey: customerRatingKeys.mine(),
    queryFn: async () => summarizeRatings(await getMyRatings()),
    enabled: options?.enabled ?? true,
    placeholderData: EMPTY_SUMMARY,
  });
}
