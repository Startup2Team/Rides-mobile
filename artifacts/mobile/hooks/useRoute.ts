import { useEffect, useRef, useState } from 'react';
import { fetchRoute, RouteResult } from '@/services/mapbox';
import { Coords } from '@/types';

interface UseRouteResult {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
}

const routeCache = new Map<string, RouteResult>();
const MAX_ROUTE_CACHE_SIZE = 20;

function getRouteKey(origin: Coords, destination: Coords) {
  return [
    origin.latitude.toFixed(4),
    origin.longitude.toFixed(4),
    destination.latitude.toFixed(4),
    destination.longitude.toFixed(4),
  ].join(',');
}

function cacheRoute(key: string, route: RouteResult) {
  if (routeCache.has(key)) routeCache.delete(key);
  routeCache.set(key, route);

  if (routeCache.size > MAX_ROUTE_CACHE_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
}

/**
 * Fetches a real road route between origin and destination.
 * Re-fetches only when coordinates actually change and no cached route exists.
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

    const key = getRouteKey(origin, destination);

    if (key === lastKey.current) return;
    lastKey.current = key;

    const cachedRoute = routeCache.get(key);
    if (cachedRoute) {
      setRoute(cachedRoute);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRoute(null);

    fetchRoute(origin, destination)
      .then(result => {
        if (!cancelled) {
          cacheRoute(key, result);
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
