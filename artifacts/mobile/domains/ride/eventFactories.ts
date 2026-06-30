import type {
  RideCancelledEvent,
  RideCancelledPayload,
  RideCompletedEvent,
  RideCompletedPayload,
  RideDriverAcceptedEvent,
  RideDriverAcceptedPayload,
  RideDriverArrivedEvent,
  RideDriverArrivedPayload,
  RideDriverEnRouteEvent,
  RideDriverEnRoutePayload,
  RideDriverOfferedEvent,
  RideDriverOfferedPayload,
  RideFareFinalizedEvent,
  RideFareFinalizedPayload,
  RideLifecycleEvent,
  RideMatchingStartedEvent,
  RideMatchingStartedPayload,
  RidePaymentAuthorizedEvent,
  RidePaymentAuthorizedPayload,
  RidePaymentCompletedEvent,
  RidePaymentCompletedPayload,
  RideRatingSubmittedEvent,
  RideRatingSubmittedPayload,
  RideRequestedEvent,
  RideRequestedPayload,
  RideStartedEvent,
  RideStartedPayload,
  RideTimeoutEvent,
  RideTimeoutPayload,
} from './events';
import { rideEventTypes, type RideEventType } from './events';
import { createRideEventId } from './idempotency';
import { assertRideSequenceNumber } from './sequence';

export interface RideEventFactoryOptions {
  sequenceNumber: number;
  correlationId: string;
  causationId?: string | null;
  eventId?: string;
  eventVersion?: number;
  timestamp?: string;
  producer?: string;
  now?: () => Date;
  idFactory?: () => string;
}

function assertValue(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') throw new Error(message);
}

function assertPayloadRideId(payload: { rideId: string }) {
  assertValue(payload.rideId, 'rideId is required');
}

function assertParticipant(value: { userId?: string; role?: string } | undefined, field: string) {
  assertValue(value?.userId, `${field}.userId is required`);
  assertValue(value?.role, `${field}.role is required`);
}

function assertLocation(value: { address?: string; latitude?: number; longitude?: number } | undefined, field: string) {
  assertValue(value?.address, `${field}.address is required`);
  if (typeof value?.latitude !== 'number') throw new Error(`${field}.latitude is required`);
  if (typeof value?.longitude !== 'number') throw new Error(`${field}.longitude is required`);
}

function assertBaseOptions(options: RideEventFactoryOptions) {
  assertRideSequenceNumber(options.sequenceNumber);
  assertValue(options.correlationId, 'correlationId is required');
  if (options.eventVersion !== undefined && (!Number.isInteger(options.eventVersion) || options.eventVersion < 1)) {
    throw new Error('eventVersion must be a positive integer');
  }
}

function createRideEvent<TPayload extends { rideId: string }, TEventType extends RideEventType>(
  eventType: TEventType,
  payload: TPayload,
  options: RideEventFactoryOptions,
): DomainEvent<TPayload> & { aggregateType: 'ride'; eventType: TEventType } {
  assertPayloadRideId(payload);
  assertBaseOptions(options);
  const now = options.now ?? (() => new Date());
  return {
    eventId: options.eventId ?? options.idFactory?.() ?? createRideEventId(),
    aggregateId: payload.rideId,
    aggregateType: 'ride',
    eventType,
    eventVersion: options.eventVersion ?? 1,
    sequenceNumber: options.sequenceNumber,
    timestamp: options.timestamp ?? now().toISOString(),
    correlationId: options.correlationId,
    causationId: options.causationId ?? null,
    producer: options.producer ?? 'mobile',
    payload,
  };
}

export function createRideRequestedEvent(payload: RideRequestedPayload, options: RideEventFactoryOptions): RideRequestedEvent {
  assertParticipant(payload.customer, 'customer');
  assertLocation(payload.pickup, 'pickup');
  assertLocation(payload.destination, 'destination');
  assertValue(payload.requestedVehicleType, 'requestedVehicleType is required');
  return createRideEvent(rideEventTypes.requested, payload, options) as RideRequestedEvent;
}

export function createRideMatchingStartedEvent(payload: RideMatchingStartedPayload, options: RideEventFactoryOptions): RideMatchingStartedEvent {
  assertValue(payload.matchingStartedAt, 'matchingStartedAt is required');
  assertValue(payload.requestedVehicleType, 'requestedVehicleType is required');
  return createRideEvent(rideEventTypes.matchingStarted, payload, options) as RideMatchingStartedEvent;
}

export function createRideDriverOfferedEvent(payload: RideDriverOfferedPayload, options: RideEventFactoryOptions): RideDriverOfferedEvent {
  assertParticipant(payload.driver, 'driver');
  return createRideEvent(rideEventTypes.driverOffered, payload, options) as RideDriverOfferedEvent;
}

export function createRideDriverAcceptedEvent(payload: RideDriverAcceptedPayload, options: RideEventFactoryOptions): RideDriverAcceptedEvent {
  assertParticipant(payload.driver, 'driver');
  return createRideEvent(rideEventTypes.driverAccepted, payload, options) as RideDriverAcceptedEvent;
}

export function createRideDriverEnRouteEvent(payload: RideDriverEnRoutePayload, options: RideEventFactoryOptions): RideDriverEnRouteEvent {
  assertValue(payload.driverId, 'driverId is required');
  return createRideEvent(rideEventTypes.driverEnRoute, payload, options) as RideDriverEnRouteEvent;
}

export function createRideDriverArrivedEvent(payload: RideDriverArrivedPayload, options: RideEventFactoryOptions): RideDriverArrivedEvent {
  assertValue(payload.driverId, 'driverId is required');
  assertValue(payload.arrivedAt, 'arrivedAt is required');
  return createRideEvent(rideEventTypes.driverArrived, payload, options) as RideDriverArrivedEvent;
}

export function createRideStartedEvent(payload: RideStartedPayload, options: RideEventFactoryOptions): RideStartedEvent {
  assertValue(payload.startedAt, 'startedAt is required');
  return createRideEvent(rideEventTypes.started, payload, options) as RideStartedEvent;
}

export function createRideCompletedEvent(payload: RideCompletedPayload, options: RideEventFactoryOptions): RideCompletedEvent {
  assertValue(payload.completedAt, 'completedAt is required');
  return createRideEvent(rideEventTypes.completed, payload, options) as RideCompletedEvent;
}

export function createRideCancelledEvent(payload: RideCancelledPayload, options: RideEventFactoryOptions): RideCancelledEvent {
  assertValue(payload.cancelledBy, 'cancelledBy is required');
  assertValue(payload.reason, 'cancel reason is required');
  assertValue(payload.cancelledAt, 'cancelledAt is required');
  return createRideEvent(rideEventTypes.cancelled, payload, options) as RideCancelledEvent;
}

export function createRideTimeoutEvent(payload: RideTimeoutPayload, options: RideEventFactoryOptions): RideTimeoutEvent {
  assertValue(payload.reason, 'timeout reason is required');
  assertValue(payload.timedOutAt, 'timedOutAt is required');
  return createRideEvent(rideEventTypes.timeout, payload, options) as RideTimeoutEvent;
}

export function createRideFareFinalizedEvent(payload: RideFareFinalizedPayload, options: RideEventFactoryOptions): RideFareFinalizedEvent {
  if (typeof payload.fare?.amount !== 'number') throw new Error('fare.amount is required');
  assertValue(payload.fare.currency, 'fare.currency is required');
  assertValue(payload.fare.source, 'fare.source is required');
  return createRideEvent(rideEventTypes.fareFinalized, payload, options) as RideFareFinalizedEvent;
}

export function createRidePaymentAuthorizedEvent(payload: RidePaymentAuthorizedPayload, options: RideEventFactoryOptions): RidePaymentAuthorizedEvent {
  assertValue(payload.paymentId, 'paymentId is required');
  if (typeof payload.amount !== 'number') throw new Error('amount is required');
  assertValue(payload.currency, 'currency is required');
  return createRideEvent(rideEventTypes.paymentAuthorized, payload, options) as RidePaymentAuthorizedEvent;
}

export function createRidePaymentCompletedEvent(payload: RidePaymentCompletedPayload, options: RideEventFactoryOptions): RidePaymentCompletedEvent {
  assertValue(payload.paymentId, 'paymentId is required');
  if (typeof payload.amount !== 'number') throw new Error('amount is required');
  assertValue(payload.currency, 'currency is required');
  assertValue(payload.completedAt, 'completedAt is required');
  return createRideEvent(rideEventTypes.paymentCompleted, payload, options) as RidePaymentCompletedEvent;
}

export function createRideRatingSubmittedEvent(payload: RideRatingSubmittedPayload, options: RideEventFactoryOptions): RideRatingSubmittedEvent {
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    throw new Error('rating must be an integer from 1 to 5');
  }
  assertValue(payload.submittedBy, 'submittedBy is required');
  assertValue(payload.submittedAt, 'submittedAt is required');
  return createRideEvent(rideEventTypes.ratingSubmitted, payload, options) as RideRatingSubmittedEvent;
}
import type { DomainEvent } from '@/events';
