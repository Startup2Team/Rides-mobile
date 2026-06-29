import type { RideLifecycleEvent } from '../events';
import { rideEventTypes } from '../events';
import type { RideHistoryReadModel } from '../readModels';
import { applyEventMetadata, shouldIgnoreEvent } from './projectorGuards';
import { eventTimestamp, unknownRideLocation, unknownRideParticipant } from './projectorMappers';

export interface RideHistoryProjectionState {
  rides: RideHistoryReadModel[];
  lastSequenceNumber: number;
}

function sortHistory(rides: RideHistoryReadModel[]) {
  return [...rides].sort((a, b) => (b.completedAt ?? b.cancelledAt ?? b.requestedAt).localeCompare(a.completedAt ?? a.cancelledAt ?? a.requestedAt));
}

function findRide(rides: RideHistoryReadModel[], rideId: string) {
  return rides.find(ride => ride.rideId === rideId) ?? null;
}

function createBaseHistory(event: RideLifecycleEvent): RideHistoryReadModel {
  const requestedPayload = event.eventType === rideEventTypes.requested ? event.payload : null;
  return {
    rideId: event.payload.rideId,
    status: 'requested',
    customer: requestedPayload?.customer ?? unknownRideParticipant,
    driver: null,
    pickup: requestedPayload?.pickup ?? unknownRideLocation,
    destination: requestedPayload?.destination ?? unknownRideLocation,
    fare: null,
    requestedAt: eventTimestamp(event),
    completedAt: null,
    cancelledAt: null,
    paymentId: null,
    paymentAuthorizedAt: null,
    paymentCompletedAt: null,
    rating: null,
    ratingSubmittedAt: null,
    sequenceNumber: 0,
    projection: { appliedEventIds: [] },
  };
}

function upsert(rides: RideHistoryReadModel[], next: RideHistoryReadModel) {
  const exists = rides.some(ride => ride.rideId === next.rideId);
  return sortHistory(exists ? rides.map(ride => ride.rideId === next.rideId ? next : ride) : [...rides, next]);
}

export function projectRideHistoryEvent(current: RideHistoryReadModel[], event: RideLifecycleEvent): RideHistoryReadModel[] {
  const existing = findRide(current, event.payload.rideId);
  if (shouldIgnoreEvent(existing, event)) return current;

  switch (event.eventType) {
    case rideEventTypes.requested:
      return upsert(current, applyEventMetadata({
        ...createBaseHistory(event),
        status: 'requested',
      }, event));
    case rideEventTypes.driverOffered:
      return existing ? upsert(current, applyEventMetadata({
        ...existing,
        driver: event.payload.driver,
        fare: event.payload.offeredFare ?? existing.fare ?? null,
      }, event)) : current;
    case rideEventTypes.driverAccepted:
      return existing ? upsert(current, applyEventMetadata({
        ...existing,
        status: 'accepted',
        driver: event.payload.driver,
        fare: event.payload.acceptedFare ?? existing.fare ?? null,
      }, event)) : current;
    case rideEventTypes.completed: {
      const base = existing ?? createBaseHistory(event);
      return upsert(current, applyEventMetadata({
        ...base,
        status: 'completed',
        completedAt: event.payload.completedAt,
      }, event));
    }
    case rideEventTypes.cancelled: {
      const base = existing ?? createBaseHistory(event);
      return upsert(current, applyEventMetadata({
        ...base,
        status: 'cancelled',
        cancelledAt: event.payload.cancelledAt,
      }, event));
    }
    case rideEventTypes.timeout: {
      const base = existing ?? createBaseHistory(event);
      return upsert(current, applyEventMetadata({
        ...base,
        status: 'timeout',
        cancelledAt: event.payload.timedOutAt,
      }, event));
    }
    case rideEventTypes.fareFinalized:
      return existing ? upsert(current, applyEventMetadata({ ...existing, status: 'fare_finalized', fare: event.payload.fare }, event)) : current;
    case rideEventTypes.paymentAuthorized:
      return existing ? upsert(current, applyEventMetadata({
        ...existing,
        status: 'payment_authorized',
        paymentId: event.payload.paymentId,
        paymentAuthorizedAt: eventTimestamp(event),
      }, event)) : current;
    case rideEventTypes.paymentCompleted:
      return existing ? upsert(current, applyEventMetadata({
        ...existing,
        status: 'payment_completed',
        paymentId: event.payload.paymentId,
        paymentCompletedAt: event.payload.completedAt,
      }, event)) : current;
    case rideEventTypes.ratingSubmitted:
      return existing ? upsert(current, applyEventMetadata({
        ...existing,
        status: 'rating_submitted',
        rating: event.payload.rating,
        ratingSubmittedAt: event.payload.submittedAt,
      }, event)) : current;
    default:
      return current;
  }
}

export const rideHistoryProjector = {
  id: 'ride.rideHistoryProjector',
  eventTypes: '*' as const,
  project(event: RideLifecycleEvent, state: RideHistoryProjectionState): RideHistoryProjectionState {
    const rides = projectRideHistoryEvent(state.rides, event);
    return {
      rides,
      lastSequenceNumber: Math.max(state.lastSequenceNumber, event.sequenceNumber),
    };
  },
};
