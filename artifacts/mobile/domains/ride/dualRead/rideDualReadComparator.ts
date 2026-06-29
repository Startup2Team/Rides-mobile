import { compareActiveRide as compareShadowActiveRide, compareDriverRequests as compareShadowDriverRequests, compareRideHistory as compareShadowRideHistory } from '../shadow/shadowComparator';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import type { Ride } from '@/types';
import type { RideDualReadComparison } from './rideDualReadTypes';
import { createRideDualReadComparison } from './rideDualReadTypes';

export function compareActiveRide(live: Ride | null, projected: ActiveRideReadModel | null) {
  return compareShadowActiveRide(live, projected);
}

export function compareRideHistory(live: Ride[] = [], projected: RideHistoryReadModel[]) {
  return compareShadowRideHistory(live, projected);
}

export function compareDriverRequests(live: Ride[] = [], projected: DriverRideRequestReadModel[]) {
  return compareShadowDriverRequests(live, projected);
}

export function compareRideDualReadModels(
  live: {
    activeRide: Ride | null;
    rideHistory: Ride[];
    driverRequests: Ride[];
  },
  projected: {
    activeRide: ActiveRideReadModel | null;
    rideHistory: RideHistoryReadModel[];
    driverRequests: DriverRideRequestReadModel[];
  } | null,
): RideDualReadComparison {
  if (!projected) {
    return createRideDualReadComparison([], [], []);
  }

  return createRideDualReadComparison(
    compareActiveRide(live.activeRide, projected.activeRide),
    compareRideHistory(live.rideHistory, projected.rideHistory),
    compareDriverRequests(live.driverRequests, projected.driverRequests),
  );
}

