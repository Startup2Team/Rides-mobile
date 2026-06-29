export const savedLocationKeys = {
  all: ['saved-locations'] as const,
  list: (userId: string) => ['saved-locations', 'list', userId] as const,
  detail: (id: string) => ['saved-locations', 'detail', id] as const,
} as const;
