import { Coords, Ride } from '@/types';

export function addTrackingNoise(coords: Coords | null, magnitude: number): Coords | null {
  if (!coords) return null;
  const noise = () => (Math.random() - 0.5) * magnitude;
  return {
    latitude: coords.latitude + noise(),
    longitude: coords.longitude + noise(),
  };
}

export function markRideArrived(ride: Ride | null): Ride | null {
  const now = new Date().toISOString();
  return ride ? { ...ride, status: 'arrived', arrivedAt: now, waitStartedAt: now } : null;
}

export function startRideJourney(ride: Ride | null): Ride | null {
  if (!ride || ride.status !== 'arrived') return ride;
  return { ...ride, status: 'in_progress' };
}
