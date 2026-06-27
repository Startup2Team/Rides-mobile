import { packageRepository } from '@/data/repositories';
import type { VehicleType } from '@/types';
import { packageKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function usePackagesQuery(vehicleType?: VehicleType | null) {
  return usePolicyQuery(queryPolicies.packages, {
    queryKey: packageKeys.catalog(vehicleType),
    queryFn: async () => {
      const [catalog, campaigns, offerSource] = await Promise.all([
        packageRepository.getCatalog(),
        packageRepository.getCampaigns(),
        packageRepository.getOfferSource(),
      ]);
      return {
        catalog: catalog ?? [],
        campaigns: campaigns ?? [],
        offerSource,
      };
    },
  });
}
