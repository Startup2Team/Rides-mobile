import { RideLocation } from '@/types';

export const SAME_LOCATION_THRESHOLD_METERS = 30;

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
