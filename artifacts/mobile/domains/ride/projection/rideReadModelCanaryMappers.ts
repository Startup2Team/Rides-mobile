import type { Ride } from '@/types';
import type { RideHistoryReadModel, RideLocationSnapshot } from '../readModels';

function assertRideLocationSnapshot(location: RideLocationSnapshot | undefined, label: string): RideLocationSnapshot {
  if (!location) {
    throw new Error(`Projected ride ${label} location is missing.`);
  }
  if (
    typeof location.address !== 'string'
    || typeof location.latitude !== 'number'
    || typeof location.longitude !== 'number'
  ) {
    throw new Error(`Projected ride ${label} location is invalid.`);
  }
  return location;
}

export function normalizeProjectedRideStatus(status: RideHistoryReadModel['status']): Ride['status'] {
  switch (status) {
    case 'draft':
    case 'requested':
    case 'matching':
      return 'searching';
    case 'offered':
      return 'negotiating';
    case 'accepted':
      return 'confirmed';
    case 'driver_en_route':
      return 'arriving';
    case 'driver_arrived':
      return 'arrived';
    case 'started':
      return 'in_progress';
    case 'fare_finalized':
    case 'payment_authorized':
    case 'payment_completed':
    case 'rating_submitted':
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'timeout':
      return 'cancelled';
    default:
      return 'searching';
  }
}

export function mapProjectedRideHistoryEntry(
  liveRide: Ride | undefined,
  projectedRide: RideHistoryReadModel,
): Ride {
  const pickup = assertRideLocationSnapshot(projectedRide.pickup, 'pickup');
  const destination = assertRideLocationSnapshot(projectedRide.destination, 'destination');

  return {
    id: projectedRide.rideId,
    customerId: projectedRide.customer.userId,
    customerName: projectedRide.customer.displayName ?? liveRide?.customerName,
    customerPhone: liveRide?.customerPhone,
    customerImage: liveRide?.customerImage,
    customerRating: liveRide?.customerRating,
    driverId: projectedRide.driver?.userId ?? liveRide?.driverId,
    driverName: projectedRide.driver?.displayName ?? liveRide?.driverName,
    driver: liveRide?.driver,
    vehicleType: liveRide?.vehicleType ?? 'moto',
    vehicleId: liveRide?.vehicleId,
    requestedVehicleType: liveRide?.requestedVehicleType,
    matchedVehicleType: liveRide?.matchedVehicleType,
    matchedVehicleId: liveRide?.matchedVehicleId,
    pickup,
    destination,
    status: normalizeProjectedRideStatus(projectedRide.status),
    distance: liveRide?.distance ?? 0,
    duration: liveRide?.duration ?? 0,
    suggestedFare: liveRide?.suggestedFare ?? projectedRide.fare?.amount ?? 0,
    agreedFare: projectedRide.fare?.amount ?? liveRide?.agreedFare,
    negotiation: liveRide?.negotiation ?? [],
    createdAt: projectedRide.requestedAt ?? liveRide?.createdAt ?? projectedRide.completedAt ?? '1970-01-01T00:00:00.000Z',
    completedAt: projectedRide.completedAt ?? liveRide?.completedAt,
    arrivedAt: liveRide?.arrivedAt,
    waitStartedAt: liveRide?.waitStartedAt,
  };
}
