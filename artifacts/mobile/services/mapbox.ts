import polyline from '@mapbox/polyline';
import { Coords } from '@/types';
import {
  fetchWithResilience,
  NetworkRequestError,
  parseJsonResponse,
} from '@/services/networkRequest';

// pk.* tokens are public client tokens — safe to embed in the bundle.
// process.env.EXPO_PUBLIC_* is inlined by Metro at build time from .env
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
export const MAPBOX_ROUTE_TIMEOUT_MS = 12_000;
export interface RouteResult {
  coordinates: Coords[];
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchRoute(
  origin: Coords,
  destination: Coords,
  options?: { signal?: AbortSignal },
): Promise<RouteResult> {
  if (!TOKEN) {
    throw new NetworkRequestError({
      kind: 'configuration',
      service: 'mapbox',
      operation: 'directions',
    });
  }

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}` +
    `?geometries=polyline6&overview=full&access_token=${TOKEN}`;

  const res = await fetchWithResilience(
    url,
    { signal: options?.signal },
    {
      service: 'mapbox',
      operation: 'directions',
      timeoutMs: MAPBOX_ROUTE_TIMEOUT_MS,
      retries: 1,
    },
  );

  const json = await parseJsonResponse<{ routes?: {
    geometry: string;
    distance: number;
    duration: number;
  }[] }>(res, 'mapbox', 'directions');
  if (!json.routes?.length) {
    throw new NetworkRequestError({
      kind: 'invalid-response',
      service: 'mapbox',
      operation: 'directions',
    });
  }

  const route = json.routes[0];

  // polyline6 precision=6, polyline precision=5 (default)
  const decoded: [number, number][] = polyline.decode(route.geometry, 6);
  const coordinates: Coords[] = decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
