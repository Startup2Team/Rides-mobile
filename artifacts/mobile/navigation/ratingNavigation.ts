import type { AppMode } from '@/types';

export function getRatingInformationRoute(mode: AppMode | null | undefined) {
  return {
    pathname: '/rating-information' as const,
    params: {
      mode: mode ?? 'customer',
    },
  };
}
