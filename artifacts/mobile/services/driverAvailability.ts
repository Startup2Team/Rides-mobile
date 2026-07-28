import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Driver online/offline + live location under /api/v1/driver.
// Going online is gated by ride credits on the backend (returns an error if the
// driver has none) — callers should surface that to prompt a package purchase.

export async function setDriverAvailability(isOnline: boolean): Promise<void> {
  await getAppBackendClient().post('/v1/driver/availability', { body: { is_online: isOnline } });
}

export interface DriverLocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number; // km/h — sent to the backend as `speed_kmh`
  // `accuracy` is intentionally omitted: the backend's UpdateLocation handler
  // (internal/driver/handler.go) decodes only lat/lng/speed_kmh/heading and
  // ignores anything else, so we don't send it.
}

// POST /driver/location — high-frequency; the backend rate-limits to ~20/min and
// returns 204 on trim, so callers can fire-and-forget. The backend decodes the
// speed field as `speed_kmh` (NOT `speed`).
export async function updateDriverLocation(update: DriverLocationUpdate): Promise<void> {
  const body: Record<string, unknown> = { lat: update.lat, lng: update.lng };
  if (update.heading !== undefined) body.heading = update.heading;
  if (update.speed !== undefined) body.speed_kmh = update.speed;
  await getAppBackendClient().post('/v1/driver/location', { body });
}
