export const customerLevelKeys = {
  all: ['customerLevel'] as const,
  current: () => ['customerLevel', 'current'] as const,
} as const;
