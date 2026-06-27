import type { VehicleType } from '@/types';

export const packageKeys = {
  all: ['packages'] as const,
  catalog: (vehicleType?: VehicleType | null) => ['packages', 'catalog', vehicleType ?? 'all'] as const,
  campaigns: () => ['packages', 'campaigns'] as const,
  offerSource: () => ['packages', 'offer-source'] as const,
} as const;
