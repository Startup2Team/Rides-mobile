import * as Location from 'expo-location';
import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Driver online/offline + live location under /api/v1/driver.
// Going online is gated by ride credits on the backend (returns an error if the
// driver has none) — callers should surface that to prompt a package purchase.

export async function setDriverAvailability(isOnline: boolean, coords?: { lat: number; lng: number }): Promise<void> {
  let lat = coords?.lat;
  let lng = coords?.lng;

  if (isOnline && (!lat || !lng)) {
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) {
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } else {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (current) {
          lat = current.coords.latitude;
          lng = current.coords.longitude;
        }
      }
    } catch {
      // Best-effort location acquisition on Go Online toggle
    }
  }

  const body: Record<string, unknown> = { is_online: isOnline };
  if (lat !== undefined && lng !== undefined) {
    body.lat = lat;
    body.lng = lng;
  }

  await getAppBackendClient().post('/v1/driver/availability', { body });

  if (isOnline && lat !== undefined && lng !== undefined) {
    void updateDriverLocation({ lat, lng }).catch(() => {});
  }
}

export interface DriverLocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number; // km/h — sent to the backend as `speed_kmh`
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
