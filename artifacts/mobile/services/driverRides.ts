import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { mapRideResponse, type CustomerRide, type RideResponseDto } from '@/services/rides';

// Driver ride lifecycle under /api/v1/driver/rides/*. Same RideResponse shape as
// the customer side (customer_* fields populated). The driver drives the state
// machine forward: accept → en-route → arrive → start → complete.

interface Envelope<T> {
  data: T;
}

export async function getActiveDriverRide(): Promise<CustomerRide | null> {
  const response = await getAppBackendClient().get<Envelope<RideResponseDto | null>>(
    '/v1/driver/rides/active',
  );
  const data = response.data.data;
  return data ? mapRideResponse(data) : null;
}

export async function getDriverRide(rideId: string): Promise<CustomerRide> {
  const response = await getAppBackendClient().get<Envelope<RideResponseDto>>(
    `/v1/driver/rides/${rideId}`,
  );
  return mapRideResponse(response.data.data);
}

const ridePath = (rideId: string, action: string) => `/v1/driver/rides/${rideId}/${action}`;

export async function acceptRide(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'accept'), {});
}

export async function declineRide(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'decline'), {});
}

export async function driverCancelRide(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'cancel'), {});
}

export async function markEnRoute(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'en-route'), {});
}

export async function markArrived(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'arrive'), {});
}

export async function startTrip(rideId: string): Promise<void> {
  await getAppBackendClient().post(ridePath(rideId, 'start'), {});
}

export interface CompleteTripInput {
  destLat?: number;
  destLng?: number;
  destAddress?: string;
}

// POST /driver/rides/{id}/complete — optional final destination override.
export async function completeTrip(rideId: string, finalDest?: CompleteTripInput): Promise<void> {
  const body: Record<string, unknown> = {};
  if (finalDest?.destLat !== undefined) body.dest_lat = finalDest.destLat;
  if (finalDest?.destLng !== undefined) body.dest_lng = finalDest.destLng;
  if (finalDest?.destAddress !== undefined) body.dest_address = finalDest.destAddress;
  await getAppBackendClient().post(ridePath(rideId, 'complete'), { body });
}
