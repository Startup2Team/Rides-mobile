import type { DomainEvent } from '@/events';
import type { RideActorRole } from './commands';
import type { RideFareSnapshot, RideLocationSnapshot, RideParticipant } from './readModels';

export const rideEventTypes = {
  requested: 'ride.requested',
  matchingStarted: 'ride.matching.started',
  driverOffered: 'ride.driver.offered',
  driverAccepted: 'ride.driver.accepted',
  driverEnRoute: 'ride.driver.en_route',
  driverArrived: 'ride.driver.arrived',
  started: 'ride.started',
  completed: 'ride.completed',
  cancelled: 'ride.cancelled',
  timeout: 'ride.timeout',
  fareFinalized: 'ride.fare.finalized',
  paymentAuthorized: 'ride.payment.authorized',
  paymentCompleted: 'ride.payment.completed',
  ratingSubmitted: 'ride.rating.submitted',
} as const;

export type RideEventType = typeof rideEventTypes[keyof typeof rideEventTypes];

export interface RideRequestedPayload {
  rideId: string;
  customer: RideParticipant;
  pickup: RideLocationSnapshot;
  destination: RideLocationSnapshot;
  requestedVehicleType: string;
}

export interface RideMatchingStartedPayload {
  rideId: string;
  matchingStartedAt: string;
  requestedVehicleType: string;
}

export interface RideDriverOfferedPayload {
  rideId: string;
  driver: RideParticipant;
  vehicleId?: string | null;
  offeredFare?: RideFareSnapshot | null;
}

export interface RideDriverAcceptedPayload {
  rideId: string;
  driver: RideParticipant;
  acceptedFare?: RideFareSnapshot | null;
}

export interface RideDriverEnRoutePayload {
  rideId: string;
  driverId: string;
  location?: RideLocationSnapshot | null;
}

export interface RideDriverArrivedPayload {
  rideId: string;
  driverId: string;
  arrivedAt: string;
  location?: RideLocationSnapshot | null;
}

export interface RideStartedPayload {
  rideId: string;
  startedAt: string;
  location?: RideLocationSnapshot | null;
}

export interface RideCompletedPayload {
  rideId: string;
  completedAt: string;
  location?: RideLocationSnapshot | null;
}

export interface RideCancelledPayload {
  rideId: string;
  cancelledBy: RideActorRole;
  reason: string;
  cancelledAt: string;
}

export interface RideTimeoutPayload {
  rideId: string;
  reason: 'no_driver_found' | 'driver_response_timeout' | 'customer_response_timeout';
  timedOutAt: string;
}

export interface RideFareFinalizedPayload {
  rideId: string;
  fare: RideFareSnapshot;
}

export interface RidePaymentAuthorizedPayload {
  rideId: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export interface RidePaymentCompletedPayload {
  rideId: string;
  paymentId: string;
  amount: number;
  currency: string;
  completedAt: string;
}

export interface RideRatingSubmittedPayload {
  rideId: string;
  rating: number;
  submittedBy: RideActorRole;
  submittedAt: string;
}

export type RideRequestedEvent = DomainEvent<RideRequestedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.requested };
export type RideMatchingStartedEvent = DomainEvent<RideMatchingStartedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.matchingStarted };
export type RideDriverOfferedEvent = DomainEvent<RideDriverOfferedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.driverOffered };
export type RideDriverAcceptedEvent = DomainEvent<RideDriverAcceptedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.driverAccepted };
export type RideDriverEnRouteEvent = DomainEvent<RideDriverEnRoutePayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.driverEnRoute };
export type RideDriverArrivedEvent = DomainEvent<RideDriverArrivedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.driverArrived };
export type RideStartedEvent = DomainEvent<RideStartedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.started };
export type RideCompletedEvent = DomainEvent<RideCompletedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.completed };
export type RideCancelledEvent = DomainEvent<RideCancelledPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.cancelled };
export type RideTimeoutEvent = DomainEvent<RideTimeoutPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.timeout };
export type RideFareFinalizedEvent = DomainEvent<RideFareFinalizedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.fareFinalized };
export type RidePaymentAuthorizedEvent = DomainEvent<RidePaymentAuthorizedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.paymentAuthorized };
export type RidePaymentCompletedEvent = DomainEvent<RidePaymentCompletedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.paymentCompleted };
export type RideRatingSubmittedEvent = DomainEvent<RideRatingSubmittedPayload> & { aggregateType: 'ride'; eventType: typeof rideEventTypes.ratingSubmitted };

export type RideLifecycleEvent =
  | RideRequestedEvent
  | RideMatchingStartedEvent
  | RideDriverOfferedEvent
  | RideDriverAcceptedEvent
  | RideDriverEnRouteEvent
  | RideDriverArrivedEvent
  | RideStartedEvent
  | RideCompletedEvent
  | RideCancelledEvent
  | RideTimeoutEvent
  | RideFareFinalizedEvent
  | RidePaymentAuthorizedEvent
  | RidePaymentCompletedEvent
  | RideRatingSubmittedEvent;
