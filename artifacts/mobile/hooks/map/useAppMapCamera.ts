import { useMemo, type RefObject } from 'react';
import type { AppMapHandle } from '@/components/map/types';

/**
 * Stable camera-action callbacks bound to an AppMap ref. Screens can call
 * `mapRef.current?.fitToCoordinates(...)` directly too — this just avoids
 * repeating the null-check at every call site for the common cases.
 */
export function useAppMapCamera(mapRef: RefObject<AppMapHandle | null>) {
  return useMemo(
    () => ({
      fitToCoordinates: (...args: Parameters<AppMapHandle['fitToCoordinates']>) => {
        mapRef.current?.fitToCoordinates(...args);
      },
      animateToRegion: (...args: Parameters<AppMapHandle['animateToRegion']>) => {
        mapRef.current?.animateToRegion(...args);
      },
      coordinateForPoint: (...args: Parameters<AppMapHandle['coordinateForPoint']>) =>
        mapRef.current?.coordinateForPoint(...args) ?? Promise.reject(new Error('Map is not ready')),
    }),
    [mapRef],
  );
}
