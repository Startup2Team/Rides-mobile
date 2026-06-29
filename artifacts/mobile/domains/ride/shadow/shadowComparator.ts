import type { Ride } from '@/types';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import type {
  RideProjectionMismatch,
  RideProviderSnapshot,
  RideShadowComparisonResult,
  RideShadowReadModels,
  ShadowFieldDiff,
} from './shadowTypes';
import type { RideLifecycleEvent } from '../events';

function addDiff(diffs: ShadowFieldDiff[], field: string, production: unknown, shadow: unknown) {
  if (production !== shadow) {
    diffs.push({ field, production, shadow });
  }
}

function normalizeProductionStatus(status: Ride['status'] | undefined) {
  switch (status) {
    case 'searching':
      return 'requested';
    case 'negotiating':
      return 'offered';
    case 'confirmed':
      return 'accepted';
    case 'arriving':
      return 'driver_en_route';
    case 'arrived':
      return 'driver_arrived';
    case 'in_progress':
      return 'started';
    default:
      return status ?? null;
  }
}

export function compareActiveRide(production: Ride | null, shadow: ActiveRideReadModel | null): ShadowFieldDiff[] {
  const diffs: ShadowFieldDiff[] = [];
  addDiff(diffs, 'activeRide.exists', Boolean(production), Boolean(shadow));
  if (!production || !shadow) return diffs;
  addDiff(diffs, 'activeRide.rideId', production.id, shadow.rideId);
  addDiff(diffs, 'activeRide.status', normalizeProductionStatus(production.status), shadow.status);
  addDiff(diffs, 'activeRide.pickup.address', production.pickup.address ?? null, shadow.pickup.address);
  addDiff(diffs, 'activeRide.destination.address', production.destination.address ?? null, shadow.destination.address);
  addDiff(diffs, 'activeRide.driverId', production.driverId ?? production.driver?.id ?? null, shadow.driver?.userId ?? null);
  return diffs;
}

export function compareRideHistory(production: Ride[], shadow: RideHistoryReadModel[]): ShadowFieldDiff[] {
  const diffs: ShadowFieldDiff[] = [];
  addDiff(diffs, 'history.count', production.length, shadow.length);
  const shadowById = new Map(shadow.map(ride => [ride.rideId, ride]));
  production.forEach((ride, index) => {
    const projected = shadowById.get(ride.id);
    addDiff(diffs, `history.${index}.exists`, true, Boolean(projected));
    if (!projected) return;
    addDiff(diffs, `history.${index}.status`, normalizeProductionStatus(ride.status), projected.status);
    addDiff(diffs, `history.${index}.fare`, ride.agreedFare ?? ride.suggestedFare ?? null, projected.fare?.amount ?? null);
  });
  return diffs;
}

export function compareDriverRequests(production: Ride[] = [], shadow: DriverRideRequestReadModel[]): ShadowFieldDiff[] {
  const diffs: ShadowFieldDiff[] = [];
  addDiff(diffs, 'driverRequests.count', production.length, shadow.length);
  const shadowIds = new Set(shadow.map(request => request.rideId));
  production.forEach((ride, index) => {
    addDiff(diffs, `driverRequests.${index}.exists`, true, shadowIds.has(ride.id));
  });
  return diffs;
}

export function compareRideShadow(
  production: RideProviderSnapshot,
  shadow: RideShadowReadModels,
  lastEvent: RideLifecycleEvent | null,
): RideShadowComparisonResult {
  const activeRideDiff = compareActiveRide(production.activeRide, shadow.shadowActiveRide);
  const historyDiff = compareRideHistory(production.rideHistory, shadow.shadowRideHistory);
  const driverRequestDiff = compareDriverRequests(production.driverRequests ?? [], shadow.shadowDriverRequests);
  const fieldDiff = [...activeRideDiff, ...historyDiff, ...driverRequestDiff];
  const aggregateId = lastEvent?.aggregateId ?? production.activeRide?.id ?? shadow.shadowActiveRide?.rideId ?? 'unknown';
  const mismatch: RideProjectionMismatch | null = fieldDiff.length > 0
    ? {
        name: 'RideProjectionMismatch',
        aggregateId,
        eventId: lastEvent?.eventId ?? null,
        eventType: lastEvent?.eventType ?? null,
        correlationId: lastEvent?.correlationId ?? null,
        sequenceNumber: lastEvent?.sequenceNumber ?? null,
        fieldDiff,
      }
    : null;

  return {
    activeRideDiff,
    historyDiff,
    driverRequestDiff,
    mismatch,
  };
}
