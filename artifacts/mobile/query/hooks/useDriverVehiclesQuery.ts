import { vehicleRepository } from '@/data/repositories';
import { driverKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useDriverVehiclesQuery() {
  return usePolicyQuery(queryPolicies.driverVehicles, {
    queryKey: driverKeys.vehicles(),
    queryFn: async () => (await vehicleRepository.getVehicles()) ?? [],
  });
}
