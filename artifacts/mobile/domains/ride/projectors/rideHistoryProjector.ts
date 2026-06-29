import type { RideLifecycleEvent } from '../events';
import type { RideHistoryReadModel } from '../readModels';

export interface RideHistoryProjectionState {
  rides: RideHistoryReadModel[];
  lastSequenceNumber: number;
}

export const rideHistoryProjector = {
  id: 'ride.rideHistoryProjector',
  eventTypes: ['ride.completed', 'ride.cancelled', 'ride.timeout', 'ride.rating.submitted'] as const,
  project(_event: RideLifecycleEvent, state: RideHistoryProjectionState): RideHistoryProjectionState {
    return state;
  },
};
