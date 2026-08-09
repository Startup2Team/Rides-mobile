import { useEffect, useRef, useState } from 'react';
import { fetchRoute, RouteResult } from '@/services/mapbox';
import { fetchCachedRoute, recordRouteMetrics, type CachedRoute } from '@/services/locations';
import { Coords, VehicleType } from '@/types';
import { reportOperationalFailure } from '@/observability/monitoring';
import { isAbortedNetworkRequest, NetworkRequestError } from '@/services/networkRequest';

/** Where the distance/duration currently on screen came from. */
export type RouteSource = 'backend-cache' | 'mapbox';

interface UseRouteResult {
  route: RouteResult | null;
  routeKey: string | null;
  loading: boolean;
  error: string | null;
  source: RouteSource | null;
}

export interface UseRouteOptions {
  /**
   * Enables the backend route cache, which is keyed by geohash + vehicle type.
   * Without it we cannot build the key, so the hook stays purely Mapbox.
   */
  vehicleType?: VehicleType | null;
}

const routeCache = new Map<string, RouteResult>();
const MAX_ROUTE_CACHE_SIZE = 20;

export function getRouteKey(origin: Coords, destination: Coords) {
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

function reportRouteFailure(category: string, error: unknown) {
  reportOperationalFailure(category, error, {
    service: error instanceof NetworkRequestError ? error.service : 'mapbox',
    operation: error instanceof NetworkRequestError ? error.operation : 'directions',
    kind: error instanceof NetworkRequestError ? error.kind : 'unknown',
    status: error instanceof NetworkRequestError ? error.status : undefined,
    attempt: error instanceof NetworkRequestError ? error.attempt : undefined,
  });
}

/**
 * Fetches a real road route between origin and destination.
 * Re-fetches only when coordinates actually change and no cached route exists.
 * Returns null route while loading or when either coord is missing.
 *
 * When a vehicle type is supplied the backend route cache
 * (GET /locations/route) answers first: it is free and already knows the
 * distance/duration for this corridor, so the ETA and distance render without
 * waiting on Mapbox — and survive a Mapbox outage. It carries no geometry, so
 * Mapbox still draws the polyline; a fresh Mapbox reading on a cache miss is
 * written back (POST /locations/route) to warm the corridor for everyone else.
 */
export function useRoute(
  origin: Coords | null,
  destination: Coords | null,
  options: UseRouteOptions = {},
): UseRouteResult {
  const { vehicleType = null } = options;
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<RouteSource | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!origin || !destination) {
      // Clear route and reset key so next open re-fetches
      setRoute(null);
      setRouteKey(null);
      setSource(null);
      lastKey.current = null;
      return;
    }

    const key = getRouteKey(origin, destination);
    // Vehicle type changes the backend's cache entry, so it must change ours too.
    const memoryKey = vehicleType ? `${key}|${vehicleType}` : key;

    if (memoryKey === lastKey.current) return;
    lastKey.current = memoryKey;

    const cachedRoute = routeCache.get(memoryKey);
    if (cachedRoute) {
      setRoute(cachedRoute);
      setRouteKey(key);
      setSource('mapbox');
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRoute(null);
    setRouteKey(null);
    setSource(null);

    const run = async () => {
      const query = vehicleType
        ? { origin, destination, vehicleType }
        : null;

      let backendRoute: CachedRoute | null = null;
      if (query) {
        try {
          backendRoute = await fetchCachedRoute(query);
        } catch (err) {
          // A cache miss is a 200 with a null route; anything thrown here is a
          // backend or connectivity problem, and Mapbox can still answer.
          reportRouteFailure('map.route.cache_lookup', err);
        }
      }
      if (cancelled) return;

      if (backendRoute) {
        // Provisional: real numbers, no geometry yet.
        setRoute({
          coordinates: [],
          distanceMeters: backendRoute.distanceKm * 1000,
          durationSeconds: backendRoute.durationMinutes * 60,
        });
        setRouteKey(key);
        setSource('backend-cache');
        setLoading(false);
      }

      try {
        const result = await fetchRoute(origin, destination, { signal: controller.signal });
        if (cancelled) return;
        cacheRoute(memoryKey, result);
        setRoute(result);
        setRouteKey(key);
        setSource('mapbox');
        setLoading(false);

        if (query && !backendRoute) {
          const distanceKm = result.distanceMeters / 1000;
          const durationMinutes = Math.round(result.durationSeconds / 60);
          // The backend rejects non-positive readings, so only warm the cache
          // with a measurement it will accept. Fire-and-forget either way.
          if (distanceKm > 0 && durationMinutes > 0) {
            void recordRouteMetrics({ ...query, distanceKm, durationMinutes }).catch(err => {
              reportRouteFailure('map.route.cache_write', err);
            });
          }
        }
      } catch (err) {
        if (cancelled || isAbortedNetworkRequest(err)) return;
        // Backend numbers already on screen are better than an error state.
        if (backendRoute) return;
        console.warn('[useRoute] fetch failed:', err instanceof Error ? err.message : err);
        reportRouteFailure('map.route.fetch', err);
        setError(err instanceof Error ? err.message : 'Route fetch failed');
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    vehicleType,
  ]);

  return { route, routeKey, loading, error, source };
}
