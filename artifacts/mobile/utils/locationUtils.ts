import type { LocationGeocodedAddress } from 'expo-location';
import { RideLocation } from '@/types';

/** Kigali grid-style road code (KG 98 St, KK 15 Av, etc.). */
const RWANDA_GRID_ADDRESS = /\b(KG|KK|KN|KC|KR|GF|NY|NYA|NR|GC)\s*\d+\b/i;
export const CURRENT_LOCATION_MAX_STREET_ACCURACY_METERS = 40;

function getRwandaGridRoadCode(value: string | null | undefined): string | null {
  const match = value?.match(RWANDA_GRID_ADDRESS)?.[0];
  return match ? match.replace(/\s+/g, '').toUpperCase() : null;
}

function hasConflictingReverseGeocodeRoads(
  geo: LocationGeocodedAddress | null | undefined,
): boolean {
  if (!geo) return false;
  const streetCode = getRwandaGridRoadCode(geo.street);
  const nameCode = getRwandaGridRoadCode(geo.name);
  return Boolean(streetCode && nameCode && streetCode !== nameCode);
}

/**
 * Street line only for current location — e.g. "KG 98 Street", no city or district suffix.
 */
export function formatReverseGeocodeAddress(
  geo: LocationGeocodedAddress | null | undefined,
  fallback = 'Current Location',
): string {
  if (!geo) return fallback;

  const street = geo.street?.trim();
  if (street) return street;

  const name = geo.name?.trim() ?? '';
  if (name && RWANDA_GRID_ADDRESS.test(name)) {
    return name;
  }

  return fallback;
}

export function selectCurrentLocationAddress(
  geo: LocationGeocodedAddress | null | undefined,
  accuracy: number | null | undefined,
  fallback = 'Current location',
): string {
  if (
    typeof accuracy !== 'number'
    || !Number.isFinite(accuracy)
    || accuracy > CURRENT_LOCATION_MAX_STREET_ACCURACY_METERS
    || hasConflictingReverseGeocodeRoads(geo)
  ) {
    return fallback;
  }

  return formatReverseGeocodeAddress(geo, fallback);
}

export function isLatestLocationRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}

/** Home header — street line when available, otherwise a neutral current-location label. */
export function formatHomeHeaderLocation(address: string, loading: boolean): string {
  if (loading) return 'Getting location...';
  const trimmed = address.trim();
  if (!trimmed || /^set pickup location$/i.test(trimmed)) return 'Set pickup location';
  if (/^current location$/i.test(trimmed)) return 'Current location';
  return trimmed;
}

export const SAME_LOCATION_THRESHOLD_METERS = 30;

/** Pickup farther than this from device GPS triggers a confirmation before Find Driver. */
export const PICKUP_GPS_MISMATCH_THRESHOLD_METERS = 400;

export function isPickupFarFromUserGps(
  pickup: RideLocation,
  userGps: { latitude: number; longitude: number },
  thresholdMeters = PICKUP_GPS_MISMATCH_THRESHOLD_METERS,
): boolean {
  return getCoordDistance(pickup, userGps) > thresholdMeters;
}

export function getCoordDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const latMeters = (b.latitude - a.latitude) * 111000;
  const lngMeters = (b.longitude - a.longitude) * 111000 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
}

export function arePickupAndDropoffSame(pickupLoc: RideLocation, dropoffLoc: RideLocation): boolean {
  // Primary signal: physical proximity. Two points more than 30m apart are
  // different places even when they share a reverse-geocoded street name — very
  // common in Kigali, where a whole avenue reverse-geocodes to a single label
  // (e.g. "KG 17 Ave"). Comparing address strings first would flag every
  // distinct drop-off on the same street as "the same location".
  if (getCoordDistance(pickupLoc, dropoffLoc) < SAME_LOCATION_THRESHOLD_METERS) {
    return true;
  }
  // Fallback only when the coordinates can't be trusted — a free-typed / generic
  // location carries a placeholder offset instead of real coordinates, so the
  // address text is the only reliable signal there.
  const coordsUnreliable = pickupLoc.locationType === 'generic' || dropoffLoc.locationType === 'generic';
  if (!coordsUnreliable) return false;
  const pickupAddress = (pickupLoc.address ?? '').trim().toLowerCase();
  const dropoffAddress = (dropoffLoc.address ?? '').trim().toLowerCase();
  return pickupAddress.length > 0 && pickupAddress === dropoffAddress;
}

export function hasUsablePickup(pickup: RideLocation): boolean {
  return Boolean(pickup.address?.trim());
}
