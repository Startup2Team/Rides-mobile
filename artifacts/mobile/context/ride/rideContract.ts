import type {
  Coords,
  RideLocation,
  RideStatus,
  VehicleType,
} from '@/types';

export const RIDE_CONTRACT_VERSION = 1 as const;

export type RideContractVersion = typeof RIDE_CONTRACT_VERSION;
export type RideActorType = 'customer' | 'driver' | 'server' | 'support';
export type RideCommandSource = 'mobile' | 'server' | 'support';
export type RideTerminalStatus = 'completed' | 'cancelled';
export type RideLifecycleStatus = Exclude<RideStatus, 'idle'>;

export interface RideActor {
  type: RideActorType;
  id: string;
}

export interface RideCommandEnvelope<TType extends string, TPayload> {
  contractVersion: RideContractVersion;
  commandId: string;
  idempotencyKey: string;
  rideId: string;
  type: TType;
  actor: RideActor;
  source: RideCommandSource;
  expectedVersion: number | null;
  issuedAt: string;
  payload: TPayload;
}

export type RequestRideCommand = RideCommandEnvelope<'ride.request', {
  customerId: string;
  pickup: RideLocation;
  destination: RideLocation;
  vehicleType: VehicleType;
  requestedVehicleType: VehicleType;
}>;

export type CancelRideCommand = RideCommandEnvelope<'ride.cancel', {
  reasonCode?: string;
}>;

export type AcceptRideRequestCommand = RideCommandEnvelope<'ride.request.accept', {
  driverId: string;
}>;

export type DeclineRideRequestCommand = RideCommandEnvelope<'ride.request.decline', {
  driverId: string;
  reasonCode?: string;
}>;

export type SubmitRideOfferCommand = RideCommandEnvelope<'ride.offer.submit', {
  amount: number;
  currency: 'RWF';
}>;

export type AcceptRideOfferCommand = RideCommandEnvelope<'ride.offer.accept', {
  offerId: string;
}>;

export type MarkDriverArrivingCommand = RideCommandEnvelope<'ride.driver.arriving', {
  driverId: string;
}>;

export type MarkDriverArrivedCommand = RideCommandEnvelope<'ride.driver.arrived', {
  driverId: string;
  location?: Coords;
}>;

export type StartRideCommand = RideCommandEnvelope<'ride.start', {
  driverId: string;
}>;

export type CompleteRideCommand = RideCommandEnvelope<'ride.complete', {
  driverId: string;
}>;

export type UpdateDriverLocationCommand = RideCommandEnvelope<'ride.driver.location.update', {
  driverId: string;
  location: Coords;
  recordedAt: string;
}>;

export type RideCommand =
  | RequestRideCommand
  | CancelRideCommand
  | AcceptRideRequestCommand
  | DeclineRideRequestCommand
  | SubmitRideOfferCommand
  | AcceptRideOfferCommand
  | MarkDriverArrivingCommand
  | MarkDriverArrivedCommand
  | StartRideCommand
  | CompleteRideCommand
  | UpdateDriverLocationCommand;

export interface RideEventEnvelope<TType extends string, TPayload> {
  contractVersion: RideContractVersion;
  eventId: string;
  rideId: string;
  type: TType;
  sequence: number;
  rideVersion: number;
  occurredAt: string;
  causationId: string | null;
  correlationId: string;
  payload: TPayload;
}

export type RideRequestedEvent = RideEventEnvelope<'ride.requested', {
  customerId: string;
  pickup: RideLocation;
  destination: RideLocation;
  vehicleType: VehicleType;
  requestedVehicleType: VehicleType;
}>;

export type DriverAssignedEvent = RideEventEnvelope<'ride.driver.assigned', {
  driverId: string;
}>;

export type NegotiationOpenedEvent = RideEventEnvelope<'ride.negotiation.opened', {
  driverId: string;
}>;

export type RideOfferSubmittedEvent = RideEventEnvelope<'ride.offer.submitted', {
  offerId: string;
  offeredBy: Extract<RideActorType, 'customer' | 'driver'>;
  amount: number;
  currency: 'RWF';
}>;

export type RideOfferAcceptedEvent = RideEventEnvelope<'ride.offer.accepted', {
  offerId: string;
  amount: number;
  currency: 'RWF';
}>;

export type DriverArrivingEvent = RideEventEnvelope<'ride.driver.arriving', {
  driverId: string;
}>;

export type DriverArrivedEvent = RideEventEnvelope<'ride.driver.arrived', {
  driverId: string;
  location?: Coords;
}>;

export type RideStartedEvent = RideEventEnvelope<'ride.started', {
  driverId: string;
}>;

export type RideCompletedEvent = RideEventEnvelope<'ride.completed', {
  driverId: string;
  finalFare: number;
  currency: 'RWF';
}>;

export type RideCancelledEvent = RideEventEnvelope<'ride.cancelled', {
  cancelledBy: RideActor;
  reasonCode?: string;
}>;

export type DriverLocationUpdatedEvent = RideEventEnvelope<'ride.driver.location.updated', {
  driverId: string;
  location: Coords;
  recordedAt: string;
}>;

export type RideEvent =
  | RideRequestedEvent
  | DriverAssignedEvent
  | NegotiationOpenedEvent
  | RideOfferSubmittedEvent
  | RideOfferAcceptedEvent
  | DriverArrivingEvent
  | DriverArrivedEvent
  | RideStartedEvent
  | RideCompletedEvent
  | RideCancelledEvent
  | DriverLocationUpdatedEvent;

export const RIDE_ALLOWED_TRANSITIONS = {
  searching: ['driver_assigned', 'cancelled'],
  driver_assigned: ['negotiating', 'cancelled'],
  negotiating: ['confirmed', 'cancelled'],
  confirmed: ['arriving', 'cancelled'],
  arriving: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const satisfies Record<RideLifecycleStatus, readonly RideLifecycleStatus[]>;

export type RideTransitionRejectionCode =
  | 'INVALID_TRANSITION'
  | 'STALE_EXPECTED_VERSION'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'RIDE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'TERMINAL_RIDE';

export interface RideCommandAccepted {
  outcome: 'accepted';
  commandId: string;
  rideId: string;
  resultingVersion: number;
  events: RideEvent[];
  replayed: boolean;
}

export interface RideCommandRejected {
  outcome: 'rejected';
  commandId: string;
  rideId: string;
  code: RideTransitionRejectionCode;
  currentStatus?: RideLifecycleStatus;
  currentVersion?: number;
  retryable: boolean;
}

export type RideCommandResult = RideCommandAccepted | RideCommandRejected;

export interface RideServerSnapshot {
  contractVersion: RideContractVersion;
  rideId: string;
  status: RideLifecycleStatus;
  rideVersion: number;
  lastSequence: number;
  updatedAt: string;
}

export interface RideEventBatch {
  contractVersion: RideContractVersion;
  rideId: string;
  fromSequence: number;
  toSequence: number;
  events: RideEvent[];
}

export function isRideTransitionAllowed(
  from: RideLifecycleStatus,
  to: RideLifecycleStatus,
): boolean {
  return (RIDE_ALLOWED_TRANSITIONS[from] as readonly RideLifecycleStatus[]).includes(to);
}
