import type { RideLifecycleEvent } from '../events';
import type { ActiveRideReadModel } from '../readModels';

export interface ActiveRideProjectionState {
  activeRide: ActiveRideReadModel | null;
  lastSequenceNumber: number;
}

export const activeRideProjector = {
  id: 'ride.activeRideProjector',
  eventTypes: '*' as const,
  project(_event: RideLifecycleEvent, state: ActiveRideProjectionState): ActiveRideProjectionState {
    return state;
  },
};
