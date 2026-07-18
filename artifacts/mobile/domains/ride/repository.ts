import { listRides, getRide, type CustomerRide } from '@/services/rides';
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

function toMobileRide(r: CustomerRide): Ride {
  const distance = r.estimatedDistanceKm ?? 0;
  return {
    id: r.id,
    customerId: '',
    driverId: r.driverId ?? undefined,
    driverName: r.driverName ?? undefined,
    vehicleType: (r.vehicleType ?? 'moto') as VehicleType,
    pickup: { latitude: r.pickup.lat, longitude: r.pickup.lng, address: r.pickup.address },
    destination: {
      latitude: r.destination.lat,
      longitude: r.destination.lng,
      address: r.destination.address,
    },
    status: mapStatus(r.status),
    distance,
    duration: Math.round(distance * 3 + 5),
    suggestedFare: r.estimatedFareRwf ?? r.agreedFare ?? r.finalFareRwf ?? 0,
    agreedFare: r.agreedFare ?? r.finalFareRwf ?? undefined,
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

  // DRIVER ride history. The backend currently exposes only
  // /v1/driver/rides/active and /v1/driver/rides/{id} — there is NO driver
  // ride-LIST endpoint (see services/driverRides.ts), so a per-ride driver
  // history cannot be fetched. Returning an empty list here keeps driver
  // screens from silently reading the WRONG dataset (customer/passenger rides);
  // driver aggregates are sourced from /driver/stats and /driver/earnings/*
  // instead. NEEDS-BACKEND: a paginated GET /v1/driver/rides list endpoint.
  async listDriverRideHistory(_options?: RideHistoryOptions): Promise<Ride[]> {
    return [];
  },
};
