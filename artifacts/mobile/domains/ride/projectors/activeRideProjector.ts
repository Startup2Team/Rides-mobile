import type { RideLifecycleEvent } from '../events';
import { rideEventTypes } from '../events';
import type { ActiveRideReadModel } from '../readModels';
import { applyEventMetadata, shouldIgnoreEvent } from './projectorGuards';
import { eventTimestamp } from './projectorMappers';

export interface ActiveRideProjectionState {
  activeRide: ActiveRideReadModel | null;
  lastSequenceNumber: number;
}

function withLifecycle(
  current: ActiveRideReadModel,
  event: RideLifecycleEvent,
  status: ActiveRideReadModel['status'],
  phase: ActiveRideReadModel['phase'],
  updates: Partial<ActiveRideReadModel> = {},
) {
  return applyEventMetadata({
    ...current,
    ...updates,
    status,
    phase,
    updatedAt: eventTimestamp(event),
  }, event);
}

export function projectActiveRideEvent(current: ActiveRideReadModel | null, event: RideLifecycleEvent): ActiveRideReadModel | null {
  if (shouldIgnoreEvent(current, event)) return current;

  switch (event.eventType) {
    case rideEventTypes.requested:
      return applyEventMetadata({
        rideId: event.payload.rideId,
        status: 'requested',
        phase: 'pre_match',
        customer: event.payload.customer,
        driver: null,
        pickup: event.payload.pickup,
        destination: event.payload.destination,
        fare: null,
        updatedAt: eventTimestamp(event),
        sequenceNumber: 0,
        projection: { appliedEventIds: [] },
      } satisfies ActiveRideReadModel, event);
    case rideEventTypes.matchingStarted:
      return current ? withLifecycle(current, event, 'matching', 'matching') : current;
    case rideEventTypes.driverOffered:
      return current ? withLifecycle(current, event, 'offered', 'matching', {
        driver: event.payload.driver,
        fare: event.payload.offeredFare ?? current.fare ?? null,
      }) : current;
    case rideEventTypes.driverAccepted:
      return current ? withLifecycle(current, event, 'accepted', 'accepted', {
        driver: event.payload.driver,
        fare: event.payload.acceptedFare ?? current.fare ?? null,
      }) : current;
    case rideEventTypes.driverEnRoute:
      return current ? withLifecycle(current, event, 'driver_en_route', 'accepted') : current;
    case rideEventTypes.driverArrived:
      return current ? withLifecycle(current, event, 'driver_arrived', 'active') : current;
    case rideEventTypes.started:
      return current ? withLifecycle(current, event, 'started', 'active') : current;
    case rideEventTypes.fareFinalized:
      return current ? withLifecycle(current, event, 'fare_finalized', 'settlement', { fare: event.payload.fare }) : current;
    case rideEventTypes.paymentAuthorized:
      return current ? withLifecycle(current, event, 'payment_authorized', 'settlement') : current;
    case rideEventTypes.paymentCompleted:
      return current ? withLifecycle(current, event, 'payment_completed', 'settlement') : current;
    case rideEventTypes.ratingSubmitted:
      return current ? withLifecycle(current, event, 'rating_submitted', 'closed') : current;
    case rideEventTypes.completed:
    case rideEventTypes.cancelled:
    case rideEventTypes.timeout:
      return null;
    default:
      return current;
  }
}

export const activeRideProjector = {
  id: 'ride.activeRideProjector',
  eventTypes: '*' as const,
  project(event: RideLifecycleEvent, state: ActiveRideProjectionState): ActiveRideProjectionState {
    const activeRide = projectActiveRideEvent(state.activeRide, event);
    return {
      activeRide,
      lastSequenceNumber: Math.max(state.lastSequenceNumber, activeRide?.sequenceNumber ?? event.sequenceNumber),
    };
  },
};
