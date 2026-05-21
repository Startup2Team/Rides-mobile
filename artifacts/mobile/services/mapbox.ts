import polyline from '@mapbox/polyline';
import { Coords } from '@/types';

// pk.* tokens are public client tokens — safe to embed in the bundle.
// process.env.EXPO_PUBLIC_* is inlined by Metro at build time from .env
const TOKEN: string =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN
export interface RouteResult {
  coordinates: Coords[];
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchRoute(
  origin: Coords,
  destination: Coords,
): Promise<RouteResult> {
  if (!TOKEN) throw new Error('EXPO_PUBLIC_MAPBOX_TOKEN is not set');

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}` +
    `?geometries=polyline6&overview=full&access_token=${TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mapbox Directions error ${res.status}: ${body}`);
  }

  const json = await res.json();
  if (!json.routes?.length) throw new Error('No route found between these locations');

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
