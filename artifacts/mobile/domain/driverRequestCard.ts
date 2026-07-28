import type { Coords, RideLocation } from '@/types';
import { haversineKm } from '@/utils/mapUtils';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatRequestLocation(
  location: Pick<RideLocation, 'address'> | null | undefined,
  fallback: string,
) {
  return location?.address?.trim() || fallback;
}

export function formatDistanceToPickup(
  driverLocation: Coords | null | undefined,
  pickup: Coords | null | undefined,
) {
  if (!driverLocation || !pickup) return 'Distance unavailable';
  const meters = Math.max(0, Math.round(haversineKm(driverLocation, pickup) * 1000));
  if (meters < 200) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export function formatTripDistance(distanceKm: number | null | undefined) {
  if (!isFiniteNumber(distanceKm) || distanceKm <= 0) return 'Distance unavailable';
  return `${distanceKm} km`;
}

export function formatTripDuration(durationMinutes: number | null | undefined) {
  if (!isFiniteNumber(durationMinutes) || durationMinutes <= 0) return 'Time unavailable';
  return `~${durationMinutes} min`;
}
