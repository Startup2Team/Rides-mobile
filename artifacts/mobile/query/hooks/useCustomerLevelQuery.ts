import { useAuth } from '@/context/AuthContext';
import { fetchCustomerLevel } from '@/services/customerLevel';
import { customerLevelKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Customer gamification level (GET /customer/level). Only fetched for a
// signed-in customer; the backend owns the tier math.
export function useCustomerLevelQuery() {
  const { user } = useAuth();
  return usePolicyQuery(queryPolicies.profile, {
    queryKey: customerLevelKeys.current(),
    queryFn: fetchCustomerLevel,
    enabled: !!user,
  });
}
