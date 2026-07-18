import {
  getDailyEarnings,
  getWeeklyEarnings,
  type DriverEarnings,
} from '@/services/driverEarnings';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Backend-authoritative daily earnings (GET /v1/driver/earnings/daily).
// Returns both the driver payout total and the completed-ride count for today.
export function useDriverDailyEarningsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverEarnings>(queryPolicies.driverEarnings, {
    queryKey: driverKeys.earnings('daily'),
    queryFn: () => getDailyEarnings(),
    enabled: options?.enabled ?? true,
  });
}

// Backend-authoritative last-7-days earnings (GET /v1/driver/earnings/weekly).
// The backend does not return a ride count for the weekly window.
export function useDriverWeeklyEarningsQuery(options?: { enabled?: boolean }) {
  return usePolicyQuery<DriverEarnings>(queryPolicies.driverEarnings, {
    queryKey: driverKeys.earnings('weekly'),
    queryFn: () => getWeeklyEarnings(),
    enabled: options?.enabled ?? true,
  });
}
