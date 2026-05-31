import { api } from './api';
import { VehicleTypeCode } from './vehicleTypes';

export interface NearbyDriverPin {
  transport_type: VehicleTypeCode;
  distance_m: number;
  approx_lat: number;
  approx_lng: number;
  /** Estimated arrival time in minutes (city-speed estimate, no routing call). */
  eta_minutes: number;
}

/**
 * POST /api/v1/customer/location — returns anonymised nearby drivers.
 *
 * `transport_type` is optional. Omit it to receive all vehicle types in one
 * call (the backend fans out the Redis GEO query per type and merges results).
 */
export async function getNearbyDrivers(
  lat: number,
  lng: number,
  transport_type?: VehicleTypeCode,
): Promise<NearbyDriverPin[]> {
  const body: Record<string, unknown> = { lat, lng };
  if (transport_type) body.transport_type = transport_type;
  const { data } = await api.post('/customer/location', body);
  return Array.isArray(data?.drivers) ? data.drivers : [];
}

/**
 * GET /api/v1/customer/rides/active
 * Returns the customer's current non-terminal ride.
 * 404 when idle — catch and treat as null.
 */
export async function getActiveCustomerRide(): Promise<ReturnType<typeof createRide> | null> {
  try {
    const { data } = await api.get('/customer/rides/active');
    return data ?? null;
  } catch {
    return null;
  }
}

export async function createRide(params: {
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dest_lat: number;
  dest_lng: number;
  dest_address: string;
  transport_type: VehicleTypeCode;
  initial_fare?: number;
}) {
  const { data } = await api.post('/customer/rides', params);
  return data;
}

export async function listRides(limit = 20, offset = 0) {
  const { data } = await api.get('/customer/rides', { params: { limit, offset } });
  return data;
}

export async function getRide(rideId: string) {
  const { data } = await api.get(`/customer/rides/${rideId}`);
  return data;
}

export async function cancelRide(rideId: string, reason: string) {
  await api.delete(`/customer/rides/${rideId}`, { data: { reason } });
}

export async function proposeNegotiation(rideId: string, amount: number) {
  await api.post(`/customer/rides/${rideId}/negotiation/propose`, { amount });
}

export async function acceptNegotiation(rideId: string) {
  await api.post(`/customer/rides/${rideId}/negotiation/accept`);
}
