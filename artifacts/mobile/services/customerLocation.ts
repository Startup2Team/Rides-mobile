import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { BackendError } from '@/data/remote/contracts/backendErrors';

// Customer live location under /api/v1/rides/{id}/customer-location — shown to
// the driver on their navigate screen during an active ride. Mirrors
// services/driverAvailability.ts's updateDriverLocation: high-frequency,
// fire-and-forget, 204 on success.

export interface CustomerLocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number; // km/h — sent to the backend as `speed_kmh`
}

// POST /rides/{id}/customer-location. Callers should catch and inspect the
// error with isTerminalCustomerLocationError below: a rate limit or a dropped
// connection just means retry on the next tick, but a 404/409 means the ride
// is gone on the backend and streaming should stop instead of retrying
// forever — never surface either case to the rider or let it block the ride
// UI.
export async function updateCustomerLocation(
  rideId: string,
  update: CustomerLocationUpdate,
): Promise<void> {
  const body: Record<string, unknown> = { lat: update.lat, lng: update.lng };
  if (update.heading !== undefined) body.heading = update.heading;
  if (update.speed !== undefined) body.speed_kmh = update.speed;
  await getAppBackendClient().post(`/v1/rides/${rideId}/customer-location`, { body });
}

// True when the backend has definitively rejected the update because the ride
// is no longer live: 404 (unknown/expired ride) or 409 (RIDE_NOT_ACTIVE).
// Callers use this to stop streaming — otherwise a background task or a
// foreground publish loop keeps POSTing (and, on native, keeps the
// foreground-service "sharing your location" notification up) for a ride
// that already ended on the server. Any other status (offline, timeout, rate
// limit, 5xx) is transient and callers should just retry on the next tick.
export function isTerminalCustomerLocationError(error: unknown): boolean {
  return error instanceof BackendError && (error.status === 404 || error.status === 409);
}
