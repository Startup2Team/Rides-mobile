import polyline from '@mapbox/polyline';
import { Coords } from '@/types';

/**
 * Decode a backend-supplied encoded polyline (OSRM route_geometry, precision 5)
 * into map coordinates. Mirrors services/mapbox.ts's decode of Mapbox Directions
 * geometry, which uses precision 6 — the two are NOT interchangeable.
 */
export function decodeRoutePolyline(encoded: string): Coords[] {
  const decoded: [number, number][] = polyline.decode(encoded, 5);
  return decoded.map(([latitude, longitude]) => ({ latitude, longitude }));
}

/**
 * Stable React `key` for a LIVE (continuously moving) map marker — a driver's
 * own GPS fix, or a counterpart's `driver_location`/`customer_location` WS
 * push. `@rnmapbox/maps` `MarkerView` is supposed to reposition reactively
 * when its `coordinate` prop changes (it calls the native
 * `updateViewAnnotation`), but in practice the repositioned view annotation
 * can go stale on-device until something else forces the map to recompute
 * annotation layout (matches `AppMap.mapbox.tsx`'s own note that annotations
 * "can end up positioned incorrectly until the next camera move recomputes
 * them"). Keying the marker on its (rounded) coordinate forces React to
 * unmount + remount it — a fresh `addViewAnnotation` — on every real
 * position change, which sidesteps that staleness regardless of its exact
 * native cause. Round to `precisionDecimals` (default 5 ≈ 1.1 m) so GPS
 * jitter while stationary doesn't remount every tick — only genuine movement
 * does. Cheap no-op on `react-native-maps` (Google `Marker` already
 * repositions correctly), so safe to key everywhere a marker moves live.
 */
export function markerPositionKey(coords: Coords, precisionDecimals = 5): string {
  return `${coords.latitude.toFixed(precisionDecimals)},${coords.longitude.toFixed(precisionDecimals)}`;
}

/** Haversine distance in km between two coordinates */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Format seconds into a human-readable string e.g. "12 min" or "1 h 5 min" */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Format meters into km string e.g. "4.2 km" */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

const ROUTE_FIT_MAX_POINTS = 48;

/** Downsample a long polyline for stable map fitting without losing extent. */
export function sampleRouteCoordsForFit(
  coordinates: Coords[],
  maxPoints = ROUTE_FIT_MAX_POINTS,
): Coords[] {
  if (coordinates.length <= maxPoints) return coordinates;
  const sampled: Coords[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * (coordinates.length - 1));
    sampled.push(coordinates[index]);
  }
  return sampled;
}

/**
 * Extend Directions geometry so the drawn line starts/ends at pin-tip coordinates.
 * Pins stay on the customer-picked point; road nodes may be slightly offset on the network.
 */
export function routePolylineThroughPinTips(
  geometry: Coords[],
  startPin: Coords | null,
  endPin: Coords | null,
): Coords[] {
  if (geometry.length < 2) {
    if (startPin && endPin) return [startPin, endPin];
    if (startPin) return [startPin];
    if (endPin) return [endPin];
    return geometry;
  }
  const line = [...geometry];
  if (startPin) line[0] = startPin;
  if (endPin) line[line.length - 1] = endPin;
  return line;
}

/** Home route previews must never substitute a direct pickup-to-destination line. */
export function homeRoutePolyline(
  geometry: Coords[],
  pickup: Coords,
  destination: Coords,
): Coords[] {
  if (geometry.length < 2) return [];
  return routePolylineThroughPinTips(geometry, pickup, destination);
}

/**
 * First/last point of a driving route polyline (usually on the nearest road).
 * Use for route geometry only — not for customer pickup/dropoff pins (use stored RideLocation coords).
 */
export function routeLineEndpoints(
  coordinates: Coords[] | null | undefined,
  fallbackStart: Coords,
  fallbackEnd: Coords,
): { start: Coords; end: Coords } {
  if (!coordinates || coordinates.length < 2) {
    return { start: fallbackStart, end: fallbackEnd };
  }
  return {
    start: coordinates[0],
    end: coordinates[coordinates.length - 1],
  };
}

/**
 * Compute a bounding region that fits all given coordinates with padding.
 * Returns an object compatible with react-native-maps fitToCoordinates edgePadding.
 */
export function boundingRegion(coords: Coords[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  if (coords.length === 0) throw new Error('No coordinates provided');

  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latPad = (maxLat - minLat) * 0.2 || 0.01;
  const lngPad = (maxLng - minLng) * 0.2 || 0.01;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: maxLat - minLat + latPad,
    longitudeDelta: maxLng - minLng + lngPad,
  };
}
