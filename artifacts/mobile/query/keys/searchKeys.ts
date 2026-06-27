import type { Coords } from '@/types';

export const searchKeys = {
  all: ['search'] as const,
  autocomplete: (query: string, near?: Coords | null) => near
    ? ['search', 'autocomplete', query, near.latitude, near.longitude] as const
    : ['search', 'autocomplete', query] as const,
  reverseGeocode: (coords: Coords) => ['search', 'reverse-geocode', coords.latitude, coords.longitude] as const,
  recent: () => ['search', 'recent'] as const,
} as const;
