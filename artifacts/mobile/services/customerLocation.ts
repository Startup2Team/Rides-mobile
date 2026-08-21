import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

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

// POST /rides/{id}/customer-location. Callers should swallow errors (a 404
// while the backend endpoint isn't deployed yet, a rate limit, or a dropped
// connection) and just retry on the next tick — never surface this to the
// rider or let it block the ride UI.
export async function updateCustomerLocation(
  rideId: string,
  update: CustomerLocationUpdate,
): Promise<void> {
  const body: Record<string, unknown> = { lat: update.lat, lng: update.lng };
  if (update.heading !== undefined) body.heading = update.heading;
  if (update.speed !== undefined) body.speed_kmh = update.speed;
  await getAppBackendClient().post(`/v1/rides/${rideId}/customer-location`, { body });
}
