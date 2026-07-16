export const demandHeatmapKeys = {
  all: ['demandHeatmap'] as const,
  scoped: (lat: number | null, lng: number | null) =>
    ['demandHeatmap', 'scoped', lat ?? 'none', lng ?? 'none'] as const,
} as const;
