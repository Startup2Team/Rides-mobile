import type { Coords } from '@/types';

/**
 * Pure geo helpers backing the Mapbox implementation of the map abstraction.
 * Kept dependency-free (no turf) so they're trivial to unit test and don't
 * add to the bundle.
 */

/** [ne, sw] bounding corners for Camera#fitBounds, from a list of coordinates. */
export function boundsFromCoordinates(coordinates: Coords[]): { ne: Coords; sw: Coords } {
  if (coordinates.length === 0) throw new Error('No coordinates provided');
  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;
  for (const c of coordinates) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }
  return {
    ne: { latitude: maxLat, longitude: maxLng },
    sw: { latitude: minLat, longitude: minLng },
  };
}

/**
 * Approximates a react-native-maps `Region` (degrees-of-longitude-visible)
 * as a Mapbox `zoomLevel` (standard Web Mercator, 360deg at zoom 0).
 * Good enough for "same visual zoom" seeding/recentring — not used for
 * anything precision-critical.
 */
export function regionToZoomLevel(longitudeDelta: number): number {
  const delta = Math.max(longitudeDelta, 1e-6);
  return Math.log2(360 / delta);
}

/**
 * Geodesic destination point `distanceMeters` away from `origin` along
 * `bearingDegrees`. Used to build an accurate real-world-meters circle
 * polygon (Mapbox's CircleLayer radius is in screen pixels, not meters).
 */
function destinationPoint(origin: Coords, distanceMeters: number, bearingDegrees: number): Coords {
  const EARTH_RADIUS_M = 6371000;
  const angularDistance = distanceMeters / EARTH_RADIUS_M;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lng1 = (origin.longitude * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/** Closed-ring polygon (GeoJSON `Position[]`, [lng, lat] order) approximating
 * a real-world circle of `radiusMeters` around `center`. */
export function circlePolygon(
  center: Coords,
  radiusMeters: number,
  points = 32,
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const bearing = (i / points) * 360;
    const point = destinationPoint(center, radiusMeters, bearing);
    ring.push([point.longitude, point.latitude]);
  }
  return ring;
}
