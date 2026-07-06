import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { toBackendTransportType, fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend: POST /api/v1/customer/location returns nearby online drivers as
// privacy-approximated pins (never exact coordinates).

export interface NearbyDriverPin {
  vehicleType: VehicleType | null;
  distanceM: number;
  latitude: number;
  longitude: number;
  etaMinutes: number;
}

interface NearbyDriverDto {
  transport_type: string;
  distance_m: number;
  approx_lat: number;
  approx_lng: number;
  eta_minutes: number;
}

interface NearbyDriversEnvelope {
  data: { drivers: NearbyDriverDto[] | null };
}

export async function getNearbyDrivers(
  latitude: number,
  longitude: number,
  vehicle?: VehicleType,
): Promise<NearbyDriverPin[]> {
  const client = getAppBackendClient();
  const body: Record<string, unknown> = { lat: latitude, lng: longitude };
  if (vehicle) body.transport_type = toBackendTransportType(vehicle);

  const response = await client.post<NearbyDriversEnvelope>('/v1/customer/location', { body });
  const drivers = response.data.data.drivers ?? [];
  return drivers.map(d => ({
    vehicleType: fromBackendTransportType(d.transport_type),
    distanceM: d.distance_m,
    latitude: d.approx_lat,
    longitude: d.approx_lng,
    etaMinutes: d.eta_minutes,
  }));
}
