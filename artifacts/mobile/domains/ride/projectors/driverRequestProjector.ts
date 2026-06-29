import type { RideLifecycleEvent } from '../events';
import type { DriverRideRequestReadModel } from '../readModels';

export interface DriverRequestProjectionState {
  requests: DriverRideRequestReadModel[];
  lastSequenceNumber: number;
}

export const driverRequestProjector = {
  id: 'ride.driverRequestProjector',
  eventTypes: ['ride.matching.started', 'ride.driver.offered', 'ride.driver.accepted', 'ride.cancelled', 'ride.timeout'] as const,
  project(_event: RideLifecycleEvent, state: DriverRequestProjectionState): DriverRequestProjectionState {
    return state;
  },
};
