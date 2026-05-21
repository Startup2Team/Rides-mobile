import { useEffect, useRef, useState } from 'react';
import { fetchRoute, RouteResult } from '@/services/mapbox';
import { Coords } from '@/types';

interface UseRouteResult {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a real road route between origin and destination.
 * Re-fetches only when coordinates actually change.
 * Returns null route while loading or when either coord is missing.
 */
export function useRoute(origin: Coords | null, destination: Coords | null): UseRouteResult {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!origin || !destination) {
      // Clear route and reset key so next open re-fetches
      setRoute(null);
      lastKey.current = null;
      return;
    }

    const key = [
      origin.latitude.toFixed(4),
      origin.longitude.toFixed(4),
      destination.latitude.toFixed(4),
      destination.longitude.toFixed(4),
    ].join(',');

    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRoute(null);

    fetchRoute(origin, destination)
      .then(result => {
        if (!cancelled) {
          setRoute(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.warn('[useRoute] fetch failed:', err?.message);
          setError(err instanceof Error ? err.message : 'Route fetch failed');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
  ]);

  return { route, loading, error };
}
