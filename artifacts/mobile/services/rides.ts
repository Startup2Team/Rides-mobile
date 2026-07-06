import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
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
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverRating: number | null;
  driverPlate: string | null;
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
  driver_id: string | null;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number | null;
  driver_plate?: string;
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
    driverId: dto.driver_id ?? null,
    driverName: dto.driver_name ?? null,
    driverPhone: dto.driver_phone ?? null,
    driverRating: dto.driver_rating ?? null,
    driverPlate: dto.driver_plate ?? null,
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

// POST /customer/rides → { ride_id, status }. initial_fare is the customer's
// opening offer for the fare negotiation (optional).
export async function createRide(input: CreateRideInput): Promise<{ rideId: string; status: string }> {
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

  const response = await client.post<Envelope<{ ride_id: string; status: string }>>(
    '/v1/customer/rides',
    { body },
  );
  return { rideId: response.data.data.ride_id, status: response.data.data.status };
}

export async function listRides(): Promise<CustomerRide[]> {
  const client = getAppBackendClient();
  const response = await client.get<Envelope<RideResponseDto[] | null>>('/v1/customer/rides');
  return (response.data.data ?? []).map(toDomain);
}

export async function getRide(rideId: string): Promise<CustomerRide> {
  const client = getAppBackendClient();
  const response = await client.get<Envelope<RideResponseDto>>(`/v1/customer/rides/${rideId}`);
  return toDomain(response.data.data);
}

// GET /customer/rides/active → the in-flight ride, or null when there is none.
export async function getActiveRide(): Promise<CustomerRide | null> {
  const client = getAppBackendClient();
  const response = await client.get<Envelope<RideResponseDto | null>>('/v1/customer/rides/active');
  const data = response.data.data;
  return data ? toDomain(data) : null;
}

export async function cancelRide(rideId: string): Promise<void> {
  const client = getAppBackendClient();
  await client.delete(`/v1/customer/rides/${rideId}`);
}
