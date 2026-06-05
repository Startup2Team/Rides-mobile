import type { LocationGeocodedAddress } from 'expo-location';
import { RideLocation } from '@/types';

/** Kigali grid-style address prefix (KG 98 St, KK 15 Av, etc.). */
const RWANDA_GRID_ADDRESS = /^(KG|KK|NY|NR|GC)\s*\d+/i;

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

/** Home header — street line only; never show generic "Current location" label text. */
export function formatHomeHeaderLocation(address: string, loading: boolean): string {
  if (loading) return 'Getting location...';
  const trimmed = address.trim();
  if (!trimmed || /^set pickup location$/i.test(trimmed)) return 'Set pickup location';
  if (/^current location$/i.test(trimmed)) return 'Getting location...';
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
  if (getCoordDistance(pickupLoc, dropoffLoc) < SAME_LOCATION_THRESHOLD_METERS) {
    return true;
  }
  const pickupAddress = (pickupLoc.address ?? '').trim().toLowerCase();
  const dropoffAddress = (dropoffLoc.address ?? '').trim().toLowerCase();
  return pickupAddress.length > 0 && pickupAddress === dropoffAddress;
}
