import type { Coords } from '@/types';
import { haversineKm } from '@/utils/mapUtils';

export const ARRIVAL_UNLOCK_KM = 1;

export function formatArrivalDistance(km: number) {
  const meters = Math.max(0, Math.round(km * 1000));
  if (meters < 200) return `${meters} m away`;
  return `${(km).toFixed(1)} km away`;
}

export function getArrivalVerification(
  driverLocation: Coords,
  pickupLocation: Coords,
) {
  const distanceKm = haversineKm(driverLocation, pickupLocation);
  return {
    canMarkArrived: distanceKm <= ARRIVAL_UNLOCK_KM,
    distanceKm,
    distanceText: formatArrivalDistance(distanceKm),
  };
}
