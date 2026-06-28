export const driverKeys = {
  all: ['driver'] as const,
  profile: () => ['driver', 'profile'] as const,
  vehicles: ((userId?: string | null) => (
    userId == null ? ['driver', 'vehicles'] as const : ['driver', userId, 'vehicles'] as const
  )) as {
    (): readonly ['driver', 'vehicles'];
    (userId: string | null | undefined): readonly ['driver', string, 'vehicles'];
  },
  vehicle: ((vehicleId: string) => ['driver', 'vehicle', vehicleId] as const) as (vehicleId: string) => readonly ['driver', 'vehicle', string],
  packages: () => ['driver', 'packages'] as const,
  dashboard: () => ['driver', 'dashboard'] as const,
} as const;
