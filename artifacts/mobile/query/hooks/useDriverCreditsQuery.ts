import { getDriverCredits, type DriverCredits } from '@/services/driverEarnings';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Backend-authoritative ride credits (GET /v1/driver/credits). This is the real
// granted balance — it reflects package activations AND admin-approved manual
// payment claims (which post rides to the entitlement ledger). The driver home
// "Rides" tile prefers this over the locally-persisted entitlement so a grant
// actually shows up.
export function useDriverCreditsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverCredits>(queryPolicies.driverCredits, {
    queryKey: driverKeys.credits(),
    queryFn: () => getDriverCredits(),
    enabled: options?.enabled ?? true,
  });
}
