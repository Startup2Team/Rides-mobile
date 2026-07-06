import type { Ride } from '@/types';
import type { ActiveRideReadModel } from '../readModels';

function assertRideLocation(location: ActiveRideReadModel['pickup'] | ActiveRideReadModel['destination'] | undefined, label: string) {
  if (!location) {
    throw new Error(`Projected active ride ${label} is missing.`);
  }
  if (
    typeof location.address !== 'string'
    || typeof location.latitude !== 'number'
    || typeof location.longitude !== 'number'
  ) {
    throw new Error(`Projected active ride ${label} is invalid.`);
  }
  return location;
}

function normalizeStatus(status: ActiveRideReadModel['status']) {
  return status;
}

function normalizePhase(phase: ActiveRideReadModel['phase']) {
  return phase;
}

export function mapProjectedActiveRideReadModel(
  liveRide: Ride | null,
  projectedRide: ActiveRideReadModel | null,
): ActiveRideReadModel | null {
  if (!projectedRide) return null;

  const pickup = assertRideLocation(projectedRide.pickup, 'pickup');
  const destination = assertRideLocation(projectedRide.destination, 'destination');

  return {
    rideId: projectedRide.rideId,
    status: normalizeStatus(projectedRide.status),
    phase: normalizePhase(projectedRide.phase),
    customer: projectedRide.customer,
    driver: projectedRide.driver ?? null,
    pickup,
    destination,
    fare: projectedRide.fare ?? null,
    etaMinutes: projectedRide.etaMinutes ?? (typeof liveRide?.driver?.eta === 'number' ? liveRide.driver.eta : null),
    updatedAt: projectedRide.updatedAt,
    sequenceNumber: projectedRide.sequenceNumber,
    projection: {
      appliedEventIds: [...projectedRide.projection.appliedEventIds],
    },
  };
}
