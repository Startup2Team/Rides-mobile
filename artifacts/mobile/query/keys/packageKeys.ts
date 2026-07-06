export const packageKeys = {
  all: ['packages'] as const,
  catalog: ((vehicleType?: string | null) => (
    vehicleType == null ? ['packages', 'catalog'] as const : ['packages', 'catalog', vehicleType] as const
  )) as {
    (): readonly ['packages', 'catalog'];
    (vehicleType: string | null | undefined): readonly ['packages', 'catalog', string];
  },
  campaigns: () => ['packages', 'campaigns'] as const,
  offerSource: () => ['packages', 'offer-source'] as const,
  entitlements: (driverId: string) => ['packages', 'entitlements', driverId] as const,
  purchases: (driverId: string) => ['packages', 'purchases', driverId] as const,
  offers: ((driverId: string, vehicleType?: string | null) => (
    vehicleType == null
      ? ['packages', 'offers', driverId] as const
      : ['packages', 'offers', driverId, vehicleType] as const
  )) as {
    (driverId: string): readonly ['packages', 'offers', string];
    (driverId: string, vehicleType: string | null | undefined): readonly ['packages', 'offers', string, string];
  },
} as const;
