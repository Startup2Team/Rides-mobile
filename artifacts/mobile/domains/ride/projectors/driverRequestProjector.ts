import type { RideLifecycleEvent } from '../events';
import { rideEventTypes } from '../events';
import type { DriverRideRequestReadModel } from '../readModels';
import { applyEventMetadata, shouldIgnoreEvent } from './projectorGuards';
import { unknownRideLocation, unknownRideParticipant } from './projectorMappers';

export interface DriverRequestProjectionState {
  requests: DriverRideRequestReadModel[];
  lastSequenceNumber: number;
}

function findRequest(requests: DriverRideRequestReadModel[], rideId: string) {
  return requests.find(request => request.rideId === rideId) ?? null;
}

function upsert(requests: DriverRideRequestReadModel[], next: DriverRideRequestReadModel) {
  const exists = requests.some(request => request.rideId === next.rideId);
  return exists ? requests.map(request => request.rideId === next.rideId ? next : request) : [...requests, next];
}

export function projectDriverRequestEvent(current: DriverRideRequestReadModel[], event: RideLifecycleEvent): DriverRideRequestReadModel[] {
  const existing = findRequest(current, event.payload.rideId);
  if (shouldIgnoreEvent(existing, event)) return current;

  switch (event.eventType) {
    case rideEventTypes.requested:
      return upsert(current, applyEventMetadata({
        rideId: event.payload.rideId,
        status: 'requested',
        customer: event.payload.customer,
        pickup: event.payload.pickup,
        destination: event.payload.destination,
        offeredFare: null,
        expiresAt: null,
        sequenceNumber: 0,
        projection: { appliedEventIds: [] },
      }, event));
    case rideEventTypes.matchingStarted: {
      const base = existing ?? {
        rideId: event.payload.rideId,
        status: 'matching' as const,
        customer: unknownRideParticipant,
        pickup: unknownRideLocation,
        destination: unknownRideLocation,
        offeredFare: null,
        expiresAt: null,
        sequenceNumber: 0,
        projection: { appliedEventIds: [] },
      };
      return upsert(current, applyEventMetadata({ ...base, status: 'matching' }, event));
    }
    case rideEventTypes.driverOffered: {
      const base = existing ?? {
        rideId: event.payload.rideId,
        status: 'offered' as const,
        customer: unknownRideParticipant,
        pickup: unknownRideLocation,
        destination: unknownRideLocation,
        offeredFare: null,
        expiresAt: null,
        sequenceNumber: 0,
        projection: { appliedEventIds: [] },
      };
      return upsert(current, applyEventMetadata({
        ...base,
        status: 'offered',
        offeredFare: event.payload.offeredFare ?? base.offeredFare ?? null,
      }, event));
    }
    case rideEventTypes.driverAccepted:
    case rideEventTypes.cancelled:
    case rideEventTypes.timeout:
      return current.filter(request => request.rideId !== event.payload.rideId);
    default:
      return current;
  }
}

export const driverRequestProjector = {
  id: 'ride.driverRequestProjector',
  eventTypes: '*' as const,
  project(event: RideLifecycleEvent, state: DriverRequestProjectionState): DriverRequestProjectionState {
    const requests = projectDriverRequestEvent(state.requests, event);
    return {
      requests,
      lastSequenceNumber: Math.max(state.lastSequenceNumber, event.sequenceNumber),
    };
  },
};
