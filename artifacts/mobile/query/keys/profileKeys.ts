export const profileKeys = {
  all: ['profile'] as const,
  current: () => ['profile', 'current'] as const,
  photo: () => ['profile', 'photo'] as const,
  identity: () => ['profile', 'identity'] as const,
} as const;
