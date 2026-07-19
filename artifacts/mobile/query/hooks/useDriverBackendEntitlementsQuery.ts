import { getDriverBackendEntitlements, type DriverBackendEntitlement } from '@/services/driverEarnings';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Backend-authoritative per-vehicle-type ride entitlements (GET
// /v1/driver/entitlements). Keeps rides_remaining and bonus_remaining SEPARATE so
// the driver home can drive the "Rides" and "Bonus Rides" tiles independently and
// so a grant (package activation or admin-approved manual payment) shows up
// promptly. Reuses the driverCredits policy: short staleTime + refetch on
// focus/mount so a grant that landed while the app was backgrounded appears.
export function useDriverBackendEntitlementsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverBackendEntitlement[]>(queryPolicies.driverCredits, {
    queryKey: driverKeys.entitlements(),
    queryFn: () => getDriverBackendEntitlements(),
    enabled: options?.enabled ?? true,
  });
}
