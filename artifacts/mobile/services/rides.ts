import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { BackendError } from '@/data/remote/contracts/backendErrors';
import { toBackendTransportType, fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend ride endpoints under /api/v1/customer/rides.
// The ride status machine on the backend:
// SEARCHING → MATCHED → NEGOTIATING → CONFIRMED → DRIVER_EN_ROUTE →
// DRIVER_ARRIVED → IN_PROGRESS → COMPLETED (+ CANCELLED).

export interface CustomerRide {
  id: string;
  status: string;
  vehicleType: VehicleType | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerRating: number | null;
  customerImageUrl: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverRating: number | null;
  driverPlate: string | null;
  driverImageUrl: string | null;
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  estimatedDistanceKm: number | null;
  customerInitialFare: number | null;
  agreedFare: number | null;
  estimatedFareRwf: number | null;
  finalFareRwf: number | null;
  cancelReason: string | null;
  driverArrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideResponseDto {
  id: string;
  status: string;
  transport_type: string;
  // Populated on the /driver/rides/* responses (the driver sees the customer).
  customer_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_rating?: number | null;
  customer_image_url?: string;
  driver_id: string | null;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number | null;
  driver_plate?: string;
  driver_image_url?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dest_lat: number;
  dest_lng: number;
  destination_address: string;
  estimated_distance_km: number | null;
  customer_initial_fare: number | null;
  agreed_fare: number | null;
  estimated_fare_rwf: number | null;
  final_fare_rwf: number | null;
  cancel_reason: string | null;
  driver_arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Envelope<T> {
  data: T;
}

// Shared with the driver side — the /driver/rides/* endpoints return the same
// RideResponse shape (with customer info populated instead of driver info).
export function mapRideResponse(dto: RideResponseDto): CustomerRide {
  return toDomain(dto);
}

function toDomain(dto: RideResponseDto): CustomerRide {
  return {
    id: dto.id,
    status: dto.status,
    vehicleType: fromBackendTransportType(dto.transport_type),
    customerId: dto.customer_id ?? null,
    customerName: dto.customer_name ?? null,
    customerPhone: dto.customer_phone ?? null,
    customerRating: dto.customer_rating ?? null,
    customerImageUrl: dto.customer_image_url || null,
    driverId: dto.driver_id ?? null,
    driverName: dto.driver_name ?? null,
    driverPhone: dto.driver_phone ?? null,
    driverRating: dto.driver_rating ?? null,
    driverPlate: dto.driver_plate ?? null,
    driverImageUrl: dto.driver_image_url || null,
    pickup: { lat: dto.pickup_lat, lng: dto.pickup_lng, address: dto.pickup_address },
    destination: { lat: dto.dest_lat, lng: dto.dest_lng, address: dto.destination_address },
    estimatedDistanceKm: dto.estimated_distance_km ?? null,
    customerInitialFare: dto.customer_initial_fare ?? null,
    agreedFare: dto.agreed_fare ?? null,
    estimatedFareRwf: dto.estimated_fare_rwf ?? null,
    finalFareRwf: dto.final_fare_rwf ?? null,
    cancelReason: dto.cancel_reason ?? null,
    driverArrivedAt: dto.driver_arrived_at ?? null,
    startedAt: dto.started_at ?? null,
    completedAt: dto.completed_at ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export interface CreateRideInput {
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  initialFare?: number;
  distanceKm?: number;
}

export interface CreateRideResult {
  rideId: string;
  status: string;
  /**
   * How long the backend will search before giving up. Optional — the fields
   * are being added to the API in parallel, so absent values simply leave the
   * searching screen on its local fallback budget.
   */
  giveUpSeconds: number | null;
  searchDeadlineAt: string | null;
}

// POST /customer/rides → { ride_id, status, give_up_seconds?, search_deadline_at? }.
// initial_fare is the customer's opening offer for the fare negotiation (optional).
export async function createRide(input: CreateRideInput): Promise<CreateRideResult> {
  const client = getAppBackendClient();
  const body: Record<string, unknown> = {
    pickup_lat: input.pickup.lat,
    pickup_lng: input.pickup.lng,
    pickup_address: input.pickup.address,
    dest_lat: input.destination.lat,
    dest_lng: input.destination.lng,
    dest_address: input.destination.address,
    transport_type: toBackendTransportType(input.vehicleType),
  };
  if (input.initialFare !== undefined) body.initial_fare = input.initialFare;
  if (input.distanceKm !== undefined) body.distance_km = input.distanceKm;

  const response = await client.post<
    Envelope<{ ride_id: string; status: string; give_up_seconds?: number; search_deadline_at?: string }>
  >('/v1/customer/rides', { body });
  const data = response.data.data;
  return {
    rideId: data.ride_id,
    status: data.status,
    giveUpSeconds:
      typeof data.give_up_seconds === 'number' && Number.isFinite(data.give_up_seconds) && data.give_up_seconds > 0
        ? data.give_up_seconds
        : null,
    searchDeadlineAt: typeof data.search_deadline_at === 'string' && data.search_deadline_at ? data.search_deadline_at : null,
  };
}

export async function listRides(): Promise<CustomerRide[]> {
  const client = getAppBackendClient();
  // The backend wraps the list: { data: { rides: [...], limit, offset } }.
  // (Reading response.data.data as a bare array silently yielded an empty
  // history — completed rides never showed in "My Trips".)
  const response = await client.get<Envelope<{ rides: RideResponseDto[] } | null>>('/v1/customer/rides');
  return (response.data.data?.rides ?? []).map(toDomain);
}

export async function getRide(rideId: string): Promise<CustomerRide> {
  const client = getAppBackendClient();
  const response = await client.get<Envelope<RideResponseDto>>(`/v1/customer/rides/${rideId}`);
  return toDomain(response.data.data);
}

// GET /customer/rides/active → the in-flight ride, or null when there is none.
// The backend returns HTTP 404 (not {data:null}) when the customer has no active
// ride, and the transport throws on 404. "No active ride" is a normal state
// (e.g. cold start with nothing in flight), so we catch it and return null
// rather than letting it bubble up as a backend error.
export async function getActiveRide(): Promise<CustomerRide | null> {
  const client = getAppBackendClient();
  try {
    const response = await client.get<Envelope<RideResponseDto | null>>('/v1/customer/rides/active');
    const data = response.data.data;
    return data ? toDomain(data) : null;
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

export async function cancelRide(rideId: string): Promise<void> {
  const client = getAppBackendClient();
  await client.delete(`/v1/customer/rides/${rideId}`);
}
