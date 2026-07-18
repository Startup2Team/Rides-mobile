import { getDriverStats, type DriverStats } from '@/services/driverEarnings';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Backend-authoritative driver performance stats (GET /v1/driver/stats):
// all-time total_rides, acceptance_rate, completion_rate, priority_tier.
export function useDriverStatsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverStats>(queryPolicies.driverStats, {
    queryKey: driverKeys.stats(),
    queryFn: () => getDriverStats(),
    enabled: options?.enabled ?? true,
  });
}
