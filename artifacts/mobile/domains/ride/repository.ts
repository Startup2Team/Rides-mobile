import { listRides, getRide, type CustomerRide } from '@/services/rides';
import { listDriverRides } from '@/services/driverRides';
import type { RideStatus, VehicleType } from '@/types';
import type { Ride } from './types';

export interface RideHistoryOptions {
  userId?: string | null;
}

// Backend ride status (SCREAMING_SNAKE) → mobile RideStatus (lowercase).
const STATUS_MAP: Record<string, RideStatus> = {
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

function mapStatus(status: string): RideStatus {
  return STATUS_MAP[status] ?? 'idle';
}

// Real trip duration from the backend timestamps when the ride actually ran;
// otherwise a distance-based ESTIMATE (used pre-/mid-trip as an ETA). Previously
// this was ALWAYS the estimate (distance*3+5), so ride-detail showed an invented
// "Duration" for completed trips even though started_at/completed_at were known.
function resolveDuration(r: CustomerRide): number {
  if (r.startedAt && r.completedAt) {
    const start = Date.parse(r.startedAt);
    const end = Date.parse(r.completedAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(1, Math.round((end - start) / 60000));
    }
  }
  return Math.round((r.estimatedDistanceKm ?? 0) * 3 + 5);
}

function toMobileRide(r: CustomerRide): Ride {
  const distance = r.estimatedDistanceKm ?? 0;
  const vehicleType = (r.vehicleType ?? 'moto') as VehicleType;
  // Build the nested driver object the detail screen renders. The backend
  // returns driver name/phone/rating/plate on the ride; previously only the flat
  // driverId/driverName were mapped, so the whole driver card was dead code.
  // location/eta aren't meaningful for a past trip — use the dropoff as a stable
  // placeholder Coords so the (required) fields are satisfied.
  const driver: Ride['driver'] = r.driverId
    ? {
        id: r.driverId,
        name: r.driverName ?? 'Driver',
        phone: r.driverPhone ?? '',
        vehicleType,
        plateNumber: r.driverPlate ?? '',
        rating: r.driverRating ?? 0,
        location: { latitude: r.destination.lat, longitude: r.destination.lng },
        eta: 0,
      }
    : undefined;
  return {
    id: r.id,
    customerId: '',
    driverId: r.driverId ?? undefined,
    driverName: r.driverName ?? undefined,
    driver,
    vehicleType,
    pickup: { latitude: r.pickup.lat, longitude: r.pickup.lng, address: r.pickup.address },
    destination: {
      latitude: r.destination.lat,
      longitude: r.destination.lng,
      address: r.destination.address,
    },
    status: mapStatus(r.status),
    distance,
    duration: resolveDuration(r),
    suggestedFare: r.estimatedFareRwf ?? r.agreedFare ?? r.finalFareRwf ?? 0,
    // Prefer the actually-charged final fare (includes surcharges/waiting/etc.)
    // over the negotiated agreed_fare for a completed trip.
    agreedFare: r.finalFareRwf ?? r.agreedFare ?? undefined,
    negotiation: [],
    createdAt: r.createdAt,
    completedAt: r.completedAt ?? undefined,
    arrivedAt: r.driverArrivedAt ?? undefined,
  };
}

// Real backend: GET /customer/rides (list) and /customer/rides/{id} (detail).
export const rideHistoryRepository = {
  // CUSTOMER (passenger) history — hits /v1/customer/rides. Do not use this on
  // driver screens: it returns the signed-in user's rides as a PASSENGER.
  async listRideHistory(_options?: RideHistoryOptions): Promise<Ride[]> {
    return (await listRides()).map(toMobileRide);
  },

  async getRideDetail(rideId: string): Promise<Ride | null> {
    try {
      return toMobileRide(await getRide(rideId));
    } catch {
      return null;
    }
  },

  // DRIVER ride history — hits GET /v1/driver/rides (driver-scoped, paginated).
  // Best-effort: on any error, returns [] so driver screens degrade to their
  // /driver/stats + /driver/earnings/* aggregates rather than showing an error.
  async listDriverRideHistory(_options?: RideHistoryOptions): Promise<Ride[]> {
    try {
      return (await listDriverRides()).map(toMobileRide);
    } catch {
      return [];
    }
  },
};
