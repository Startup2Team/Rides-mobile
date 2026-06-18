import type { AppMode } from '@/types';

export function getShareRouteForMode(mode: AppMode | undefined | null) {
  return mode === 'driver' ? '/(driver)/share' : '/(tabs)/share';
}

