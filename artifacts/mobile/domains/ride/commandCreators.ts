import type {
  AcceptRideCommand,
  AcceptRidePayload,
  CancelRideCommand,
  CancelRidePayload,
  CompleteRideCommand,
  CompleteRidePayload,
  DeclineRideCommand,
  DeclineRidePayload,
  RequestRideCommand,
  RequestRidePayload,
  RideActorRole,
  RideCommand,
  StartRideCommand,
  StartRidePayload,
  SubmitRatingCommand,
  SubmitRatingPayload,
} from './commands';
import { createRideCommandId, createRideCorrelationId, createRideIdempotencyKey } from './idempotency';

export interface RideCommandCreatorOptions {
  actorId: string;
  actorRole: RideActorRole;
  correlationId?: string;
  commandId?: string;
  idempotencyKey?: string;
  timestamp?: string;
  now?: () => Date;
  idFactory?: () => string;
  correlationIdFactory?: () => string;
}

function assertValue(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') throw new Error(message);
}

function assertActor(options: RideCommandCreatorOptions, allowedRoles: RideActorRole[]) {
  assertValue(options.actorId, 'actorId is required');
  if (!allowedRoles.includes(options.actorRole)) {
    throw new Error(`actorRole must be one of: ${allowedRoles.join(', ')}`);
  }
}

function assertLocation(value: RequestRidePayload['pickup'], field: string) {
  assertValue(value?.address, `${field}.address is required`);
  if (typeof value?.latitude !== 'number') throw new Error(`${field}.latitude is required`);
  if (typeof value?.longitude !== 'number') throw new Error(`${field}.longitude is required`);
}

function createCommand<TPayload>(
  action: string,
  payload: TPayload & { rideId: string },
  options: RideCommandCreatorOptions,
  allowedRoles: RideActorRole[],
): RideCommand<TPayload> {
  assertActor(options, allowedRoles);
  assertValue(payload.rideId, 'rideId is required');
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? createRideCommandId;
  return {
    commandId: options.commandId ?? idFactory(),
    idempotencyKey: options.idempotencyKey ?? createRideIdempotencyKey(action, payload.rideId, options.actorId),
    correlationId: options.correlationId ?? options.correlationIdFactory?.() ?? createRideCorrelationId(),
    actorId: options.actorId,
    actorRole: options.actorRole,
    timestamp: options.timestamp ?? now().toISOString(),
    payload,
  };
}

export function createRequestRideCommand(payload: RequestRidePayload, options: RideCommandCreatorOptions): RequestRideCommand {
  assertLocation(payload.pickup, 'pickup');
  assertLocation(payload.destination, 'destination');
  assertValue(payload.vehicleType, 'vehicleType is required');
  return createCommand('request', payload, options, ['customer']);
}

export function createCancelRideCommand(payload: CancelRidePayload, options: RideCommandCreatorOptions): CancelRideCommand {
  assertValue(payload.reason, 'cancel reason is required');
  const allowedRoles: RideActorRole[] = payload.reason === 'driver_cancelled'
    ? ['driver']
    : payload.reason === 'system_cancelled'
      ? ['system']
      : ['customer'];
  return createCommand('cancel', payload, options, allowedRoles);
}

export function createAcceptRideCommand(payload: AcceptRidePayload, options: RideCommandCreatorOptions): AcceptRideCommand {
  assertValue(payload.driverId, 'driverId is required');
  return createCommand('accept', payload, options, ['driver']);
}

export function createDeclineRideCommand(payload: DeclineRidePayload, options: RideCommandCreatorOptions): DeclineRideCommand {
  assertValue(payload.driverId, 'driverId is required');
  return createCommand('decline', payload, options, ['driver']);
}

export function createStartRideCommand(payload: StartRidePayload, options: RideCommandCreatorOptions): StartRideCommand {
  assertValue(payload.startedAt, 'startedAt is required');
  return createCommand('start', payload, options, ['driver', 'system']);
}

export function createCompleteRideCommand(payload: CompleteRidePayload, options: RideCommandCreatorOptions): CompleteRideCommand {
  assertValue(payload.completedAt, 'completedAt is required');
  return createCommand('complete', payload, options, ['driver', 'system']);
}

export function createSubmitRatingCommand(payload: SubmitRatingPayload, options: RideCommandCreatorOptions): SubmitRatingCommand {
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    throw new Error('rating must be an integer from 1 to 5');
  }
  return createCommand('rating', payload, options, ['customer', 'driver']);
}
