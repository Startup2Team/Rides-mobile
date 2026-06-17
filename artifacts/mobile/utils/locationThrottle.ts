import type { Coords } from '@/types';
import { haversineKm } from './mapUtils';

export interface LocationSendState {
  lat: number;
  lng: number;
  sentAt: number;
}

interface ThrottleOptions {
  /** Send if the driver has moved at least this many metres since the last send. */
  minMoveMeters: number;
  /** Send at least this often regardless of movement (heartbeat), in ms. */
  heartbeatMs: number;
}

/**
 * Decides whether a driver location update is worth sending to the server.
 *
 * Re-posting an unchanged position every few seconds is pure waste at scale —
 * the server already holds it in Redis. We only send when the driver has moved
 * a meaningful distance, or as an occasional heartbeat so the stored position
 * never goes stale. Caller passes the previous send state (or null on first).
 */
export function shouldSendLocation(
  prev: LocationSendState | null,
  next: Coords,
  now: number,
  opts: ThrottleOptions,
): boolean {
  if (!prev) return true;
  if (now - prev.sentAt >= opts.heartbeatMs) return true;
  const movedMeters = haversineKm({ latitude: prev.lat, longitude: prev.lng }, next) * 1000;
  return movedMeters >= opts.minMoveMeters;
}

// Tuning: idle drivers barely need updates (they're parked); on a trip the
// customer needs near-live tracking and the server geofence needs accuracy.
export const IDLE_THROTTLE: ThrottleOptions = { minMoveMeters: 100, heartbeatMs: 60_000 };
export const TRIP_THROTTLE: ThrottleOptions = { minMoveMeters: 20, heartbeatMs: 4_000 };
