import { observability } from '@/observability/context/observabilityContext';
import type { CapabilitySnapshot } from '@/capabilities';
import type { RideLocation, VehicleType } from '@/types';
import { createAcceptRideCommand, createRequestRideCommand, createCancelRideCommand, createDeclineRideCommand, createStartRideCommand, createSubmitRatingCommand } from '../commandCreators';
import { createCompleteRideCommand } from '../commandCreators';
import type { AcceptRidePayload, CancelRidePayload, CompleteRideCommand, CompleteRidePayload, DeclineRidePayload, RideActorRole, RequestRidePayload, StartRideCommand, StartRidePayload, SubmitRatingPayload } from '../commands';
import { processRideCommand } from './rideCommandPipeline';
import { ENABLE_RIDE_COMMAND_ENQUEUE, ENABLE_RIDE_COMMAND_PIPELINE, RIDE_COMMAND_PIPELINE_MODE } from './rideCommandTypes';

export interface RideCommandShadowBridgeContext {
  actorId?: string | null;
  actorRole?: RideActorRole | null;
  correlationId?: string | null;
  timestamp?: string | null;
  capabilitySnapshot?: CapabilitySnapshot | null;
}

export interface RideShadowRequestRideInput extends RideCommandShadowBridgeContext {
  rideId: string;
  pickup: RideLocation;
  destination: RideLocation;
  vehicleType: VehicleType;
  requestedFare?: number | null;
}

export interface RideShadowCancelRideInput extends RideCommandShadowBridgeContext, CancelRidePayload {
  rideId: string;
}

export interface RideShadowAcceptRideInput extends RideCommandShadowBridgeContext, AcceptRidePayload {
  rideId: string;
}

export interface RideShadowDeclineRideInput extends RideCommandShadowBridgeContext, DeclineRidePayload {
  rideId: string;
}

export interface RideShadowStartRideInput extends RideCommandShadowBridgeContext, StartRidePayload {
  rideId: string;
  command?: StartRideCommand;
}

export interface RideShadowCompleteRideInput extends RideCommandShadowBridgeContext, CompleteRidePayload {
  rideId: string;
  command?: CompleteRideCommand;
}

export interface RideShadowSubmitRatingInput extends RideCommandShadowBridgeContext, SubmitRatingPayload {
  rideId: string;
}

function isShadowBridgeActive() {
  return ENABLE_RIDE_COMMAND_PIPELINE &&
    !ENABLE_RIDE_COMMAND_ENQUEUE &&
    (RIDE_COMMAND_PIPELINE_MODE === 'shadow' || RIDE_COMMAND_PIPELINE_MODE === 'dryRun');
}

function normalizeActorRole(role: RideActorRole | null | undefined): RideActorRole {
  return role ?? 'customer';
}

function recordBridgeTelemetry(
  status: 'created' | 'accepted' | 'rejected' | 'failed' | 'skipped',
  action: string,
  commandType: string | null,
  details: {
    actorId?: string | null;
    actorRole?: RideActorRole | null;
    correlationId?: string | null;
    idempotencyKey?: string | null;
    reason?: string | null;
  } = {},
) {
  observability.metrics.counter(`ride.shadow_command.${status}`, 1, {
    action,
    commandType: commandType ?? 'unknown',
  });
  const logContext = {
    action,
    commandType: commandType ?? 'unknown',
    actorId: details.actorId ?? null,
    actorRole: details.actorRole ?? 'customer',
    correlationId: details.correlationId ?? null,
    idempotencyKey: details.idempotencyKey ?? null,
    reason: details.reason ?? null,
  };
  if (status === 'failed' || status === 'rejected') {
    observability.logger.warn(`RideShadowCommand${status[0].toUpperCase()}${status.slice(1)}`, logContext);
  } else {
    observability.logger.info(`RideShadowCommand${status[0].toUpperCase()}${status.slice(1)}`, logContext);
  }
}

function shadowProcess<TCommand extends {
  commandId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  actorRole: RideActorRole;
}>(
  action: string,
  commandType: string,
  command: TCommand,
  capabilitySnapshot?: CapabilitySnapshot | null,
) {
  if (!isShadowBridgeActive()) {
    recordBridgeTelemetry('skipped', action, commandType, {
      actorRole: null,
      actorId: command.actorId,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      reason: 'disabled',
    });
    return;
  }

  recordBridgeTelemetry('created', action, commandType, {
    actorRole: command.actorRole ?? 'customer',
    actorId: command.actorId ?? 'local_user',
    correlationId: command.correlationId,
    idempotencyKey: command.idempotencyKey,
  });

  try {
    const result = processRideCommand(command as never, {
      mode: RIDE_COMMAND_PIPELINE_MODE,
      capabilitySnapshot: capabilitySnapshot ?? null,
    });

    if (result.accepted) {
      recordBridgeTelemetry('accepted', action, result.route?.commandType ?? commandType, {
        actorRole: command.actorRole,
        correlationId: command.correlationId,
        idempotencyKey: command.idempotencyKey,
      });
      return;
    }

    recordBridgeTelemetry('rejected', action, result.route?.commandType ?? commandType, {
      actorRole: command.actorRole,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      reason: result.reason,
    });
  } catch (error) {
    recordBridgeTelemetry('failed', action, commandType, {
      actorRole: command.actorRole,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function resolveContext(context: RideCommandShadowBridgeContext = {}) {
  return {
    actorId: context.actorId ?? 'local_user',
    actorRole: normalizeActorRole(context.actorRole),
    correlationId: context.correlationId ?? undefined,
    timestamp: context.timestamp ?? undefined,
    capabilitySnapshot: context.capabilitySnapshot ?? null,
  };
}

export function shadowWireRequestRideCommand(input: RideShadowRequestRideInput) {
  const context = resolveContext(input);
  const command = createRequestRideCommand({
    rideId: input.rideId,
    pickup: input.pickup,
    destination: input.destination,
    vehicleType: input.vehicleType,
    requestedFare: input.requestedFare ?? null,
  }, {
    actorId: context.actorId,
    actorRole: 'customer',
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('requestRide', 'ride.request', command, context.capabilitySnapshot);
}

export function shadowWireCancelRideCommand(input: RideShadowCancelRideInput) {
  const context = resolveContext(input);
  const command = createCancelRideCommand({
    rideId: input.rideId,
    reason: input.reason,
    note: input.note ?? null,
  }, {
    actorId: context.actorId,
    actorRole: context.actorRole,
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('cancelRide', 'ride.cancel', command, context.capabilitySnapshot);
}

export function shadowWireAcceptRideCommand(input: RideShadowAcceptRideInput) {
  const context = resolveContext(input);
  const command = createAcceptRideCommand({
    rideId: input.rideId,
    driverId: input.driverId,
    vehicleId: input.vehicleId ?? null,
    acceptedFare: input.acceptedFare ?? null,
  }, {
    actorId: context.actorId,
    actorRole: 'driver',
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('acceptRide', 'ride.accept', command, context.capabilitySnapshot);
}

export function shadowWireDeclineRideCommand(input: RideShadowDeclineRideInput) {
  const context = resolveContext(input);
  const command = createDeclineRideCommand({
    rideId: input.rideId,
    driverId: input.driverId,
    reason: input.reason ?? null,
  }, {
    actorId: context.actorId,
    actorRole: 'driver',
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('declineRide', 'ride.decline', command, context.capabilitySnapshot);
}

export function shadowWireStartRideCommand(input: RideShadowStartRideInput) {
  const context = resolveContext(input);
  const command = input.command ?? createStartRideCommand({
    rideId: input.rideId,
    startedAt: input.startedAt,
    location: input.location ?? null,
  }, {
    actorId: context.actorId,
    actorRole: context.actorRole,
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('startRide', 'ride.start', command, context.capabilitySnapshot);
}

export function shadowWireCompleteRideCommand(input: RideShadowCompleteRideInput) {
  const context = resolveContext(input);
  const command = input.command ?? createCompleteRideCommand({
    rideId: input.rideId,
    completedAt: input.completedAt,
    location: input.location ?? null,
    distanceKm: input.distanceKm ?? null,
    durationSeconds: input.durationSeconds ?? null,
  }, {
    actorId: context.actorId,
    actorRole: context.actorRole,
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('completeRide', 'ride.complete', command, context.capabilitySnapshot);
}

export function shadowWireSubmitRatingCommand(input: RideShadowSubmitRatingInput) {
  const context = resolveContext(input);
  const command = createSubmitRatingCommand({
    rideId: input.rideId,
    rating: input.rating,
    comment: input.comment ?? null,
    ratedUserId: input.ratedUserId ?? null,
  }, {
    actorId: context.actorId,
    actorRole: context.actorRole,
    correlationId: context.correlationId,
    timestamp: context.timestamp,
  });
  shadowProcess('submitRating', 'ride.rating.submit', command, context.capabilitySnapshot);
}
