import type { Coords, MockDriver, NegotiationMessage, Ride, RideStatus, VehicleType } from '@/types';
import { fromBackendTransportType } from '@/constants/vehicles';
import { calcDistance, calcFare } from './rideFare';
import { generateRideId } from './rideUtils';

// Pure mappers that translate real backend WebSocket events (customer + driver
// tracking sockets) into local `Ride` state transitions. Keeping the mapping
// here keeps RideProvider focused on orchestration and makes the event → state
// contract unit-testable.

export type BackendEventPayload = Record<string, unknown>;

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

// Lifecycle event type → local RideStatus. Negotiation + location events are
// handled separately (they mutate fields rather than the top-level status).
const CUSTOMER_LIFECYCLE_STATUS: Record<string, RideStatus> = {
  driver_matched: 'negotiating',
  ride_confirmed: 'confirmed',
  driver_en_route: 'arriving',
  driver_arrived: 'arrived',
  ride_started: 'in_progress',
  ride_completed: 'completed',
  ride_cancelled: 'cancelled',
};

export function lifecycleStatusForEvent(type: string): RideStatus | undefined {
  return CUSTOMER_LIFECYCLE_STATUS[type];
}

export function isLifecycleEvent(type: string): boolean {
  return type in CUSTOMER_LIFECYCLE_STATUS;
}

// Backend ride status string → local RideStatus, used for the `ride_state`
// snapshot the socket sends on (re)connect.
const BACKEND_STATUS_TO_LOCAL: Record<string, RideStatus> = {
  SEARCHING: 'searching',
  MATCHED: 'driver_assigned',
  NEGOTIATING: 'negotiating',
  CONFIRMED: 'confirmed',
  DRIVER_EN_ROUTE: 'arriving',
  DRIVER_ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export function localStatusFromBackend(status: unknown): RideStatus | undefined {
  return typeof status === 'string' ? BACKEND_STATUS_TO_LOCAL[status] : undefined;
}

// Driver position from a `driver_location` (or matched) payload — tolerant of
// the various field spellings the backend may emit.
export function parseDriverCoords(payload: BackendEventPayload): Coords | null {
  const lat = num(payload.lat ?? payload.latitude ?? payload.driver_lat ?? payload.driver_latitude);
  const lng = num(payload.lng ?? payload.longitude ?? payload.driver_lng ?? payload.driver_longitude);
  if (lat === undefined || lng === undefined) return null;
  return { latitude: lat, longitude: lng };
}

// Merge driver identity from a `driver_matched` payload into the ride and move
// it into negotiation (the customer then negotiates the fare).
export function applyDriverMatched(ride: Ride, payload: BackendEventPayload): Ride {
  const driverId = str(payload.driver_id) ?? ride.driverId ?? ride.driver?.id;
  const name = str(payload.driver_name) ?? ride.driverName ?? ride.driver?.name ?? 'Driver';
  const phone = str(payload.driver_phone) ?? ride.driver?.phone ?? '';
  const plate = str(payload.vehicle_plate ?? payload.driver_plate ?? payload.plate_number) ?? ride.driver?.plateNumber ?? '';
  const rating = num(payload.driver_rating) ?? ride.driver?.rating ?? 5;
  const eta = num(payload.eta ?? payload.eta_minutes) ?? ride.driver?.eta ?? 5;
  const location = parseDriverCoords(payload) ?? ride.driver?.location ?? ride.pickup;

  const driver: MockDriver = {
    id: driverId ?? 'backend_driver',
    name,
    phone,
    vehicleType: ride.vehicleType,
    plateNumber: plate,
    location,
    rating,
    eta,
  };

  const nextStatus: RideStatus =
    ride.status === 'searching' || ride.status === 'driver_assigned' ? 'negotiating' : ride.status;

  return {
    ...ride,
    status: nextStatus,
    driver,
    driverId: driverId ?? ride.driverId,
    driverName: name,
  };
}

// Apply a lifecycle transition, carrying over any fare / timestamps the backend
// includes in the payload.
export function applyLifecycleEvent(ride: Ride, type: string, payload: BackendEventPayload): Ride {
  const status = CUSTOMER_LIFECYCLE_STATUS[type];
  if (!status) return ride;

  const agreedFare = num(payload.agreed_fare ?? payload.final_fare ?? payload.final_fare_rwf ?? payload.fare);
  const now = new Date().toISOString();

  const next: Ride = { ...ride, status };
  if (agreedFare !== undefined && (status === 'confirmed' || status === 'in_progress' || status === 'completed')) {
    next.agreedFare = agreedFare;
  }
  if (status === 'arrived') {
    next.arrivedAt = str(payload.driver_arrived_at) ?? ride.arrivedAt ?? now;
    next.waitStartedAt = ride.waitStartedAt ?? next.arrivedAt;
  }
  if (status === 'completed') {
    next.completedAt = str(payload.completed_at) ?? ride.completedAt ?? now;
  }
  return next;
}

// Append the counterparty's negotiation message. `viewer` is the local user's
// role — the viewer's own messages are appended optimistically elsewhere, so we
// skip echoes to avoid duplicates.
export function appendNegotiationEvent(
  ride: Ride,
  payload: BackendEventPayload,
  viewer: 'customer' | 'driver',
): Ride {
  const actor = (str(payload.actor_role) ?? str(payload.role) ?? '').toUpperCase();
  const sender: NegotiationMessage['sender'] =
    actor === 'DRIVER' ? 'driver' : actor === 'CUSTOMER' ? 'customer' : 'system';

  if (sender !== 'system' && sender === viewer) return ride;

  const amount = num(payload.amount);
  const text = str(payload.text);
  const isFinal = payload.is_final === true || payload.kind === 'accept';

  let message: NegotiationMessage | null = null;
  if (amount !== undefined) {
    message = {
      id: generateRideId(),
      sender,
      type: 'offer',
      amount,
      timestamp: new Date().toISOString(),
      ...(isFinal ? { isFinal: true } : {}),
    };
  } else if (text) {
    message = {
      id: generateRideId(),
      sender,
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
    };
  }
  if (!message) return ride;
  return { ...ride, negotiation: [...ride.negotiation, message] };
}

// Build the driver-side incoming-request Ride from a `ride_request` payload.
// The backend ride id is stashed on `backendRideId` so the driver actions
// (accept/decline/en-route/…) target the same ride.
export function buildDriverRequestFromPayload(
  payload: BackendEventPayload,
  matchedVehicle?: { vehicleId: string; vehicleType: VehicleType },
): Ride | null {
  const backendRideId = str(payload.ride_id) ?? str(payload.id);
  if (!backendRideId) return null;

  const pickupLat = num(payload.pickup_lat);
  const pickupLng = num(payload.pickup_lng);
  const destLat = num(payload.dest_lat);
  const destLng = num(payload.dest_lng);
  if (pickupLat === undefined || pickupLng === undefined || destLat === undefined || destLng === undefined) {
    return null;
  }

  const requestedVehicleType =
    fromBackendTransportType(str(payload.transport_type) ?? '') ??
    matchedVehicle?.vehicleType ??
    'moto';

  const pickup = {
    latitude: pickupLat,
    longitude: pickupLng,
    address: str(payload.pickup_address) ?? 'Pickup',
    locationType: 'precise' as const,
  };
  const destination = {
    latitude: destLat,
    longitude: destLng,
    address: str(payload.destination_address ?? payload.dest_address) ?? 'Destination',
    locationType: 'precise' as const,
  };

  const distance =
    num(payload.estimated_distance_km ?? payload.distance_km) ??
    parseFloat(calcDistance(pickup, destination).toFixed(2));
  const suggestedFare =
    num(payload.suggested_fare ?? payload.customer_initial_fare ?? payload.estimated_fare_rwf) ??
    calcFare(requestedVehicleType, distance);

  return {
    id: generateRideId(),
    backendRideId,
    customerId: str(payload.customer_id) ?? 'backend_customer',
    customerName: str(payload.customer_name) ?? 'Customer',
    customerPhone: str(payload.customer_phone) ?? '',
    ...(num(payload.customer_rating) !== undefined ? { customerRating: num(payload.customer_rating) } : {}),
    vehicleType: requestedVehicleType,
    requestedVehicleType,
    ...(matchedVehicle ? { matchedVehicleId: matchedVehicle.vehicleId, matchedVehicleType: matchedVehicle.vehicleType } : {}),
    pickup,
    destination,
    status: 'searching',
    distance,
    duration: Math.round(distance * 3 + 5),
    suggestedFare,
    negotiation: [],
    createdAt: new Date().toISOString(),
  };
}

// Driver-side incoming request event names the backend may use.
export function isDriverRequestEvent(type: string): boolean {
  return type === 'ride_request' || type === 'ride_requested' || type === 'new_ride_request';
}
