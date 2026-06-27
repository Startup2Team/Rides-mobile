export const driverKeys = {
  all: ['driver'] as const,
  profile: () => ['driver', 'profile'] as const,
  vehicles: () => ['driver', 'vehicles'] as const,
  packages: () => ['driver', 'packages'] as const,
  dashboard: () => ['driver', 'dashboard'] as const,
} as const;
