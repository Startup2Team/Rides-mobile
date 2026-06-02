import { Coords } from '@/types';

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

/** Place pins on polyline endpoints when route geometry is available. */
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
