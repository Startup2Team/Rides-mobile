export const rideKeys = {
  all: ['ride'] as const,
  active: () => ['ride', 'active'] as const,
  history: (userId: string) => ['ride', 'history', userId] as const,
} as const;
