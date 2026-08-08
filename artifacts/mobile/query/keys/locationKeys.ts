export const locationKeys = {
  all: ['locations'] as const,
  landmarks: () => ['locations', 'landmarks'] as const,
  adminUnits: (parentId: string | null) => ['locations', 'admin-units', parentId ?? 'root'] as const,
  adminUnitSearch: (query: string, level: string | null) =>
    ['locations', 'admin-units', 'search', query, level ?? 'any'] as const,
  suggestions: () => ['locations', 'suggestions'] as const,
  recent: () => ['locations', 'recent'] as const,
} as const;
