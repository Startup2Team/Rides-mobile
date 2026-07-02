import { DEFAULT_RETRY_POLICY } from '../../../offline/retry/backoff';
import type {
  AcceptRideCommand,
  CancelRideCommand,
  CompleteRideCommand,
  DeclineRideCommand,
  RequestRideCommand,
  RideLifecycleCommand,
  StartRideCommand,
  SubmitRatingCommand,
} from '../commands';
import { getRideCommandPriority, getRideCommandSafety } from './rideCommandPolicy';
import type { RideCommandRoute, RideOfflineMutationPreview } from './rideCommandTypes';

const defaultExpirationMs = 24 * 60 * 60 * 1000;

export const rideCommandRoutes: Record<RideCommandRoute['routeName'], RideCommandRoute> = {
  requestRide: {
    commandType: 'ride.request',
    routeName: 'requestRide',
    priority: 'high',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canBookRide',
    mutationTypeName: 'ride.command.request',
    safety: 'guarded',
  },
  cancelRide: {
    commandType: 'ride.cancel',
    routeName: 'cancelRide',
    priority: 'critical',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canBookRide',
    mutationTypeName: 'ride.command.cancel',
    safety: 'guarded',
  },
  acceptRide: {
    commandType: 'ride.accept',
    routeName: 'acceptRide',
    priority: 'critical',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canDrive',
    mutationTypeName: 'ride.command.accept',
    safety: 'critical',
  },
  declineRide: {
    commandType: 'ride.decline',
    routeName: 'declineRide',
    priority: 'normal',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canDrive',
    mutationTypeName: 'ride.command.decline',
    safety: 'guarded',
  },
  startRide: {
    commandType: 'ride.start',
    routeName: 'startRide',
    priority: 'critical',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canDrive',
    mutationTypeName: 'ride.command.start',
    safety: 'critical',
  },
  completeRide: {
    commandType: 'ride.complete',
    routeName: 'completeRide',
    priority: 'critical',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canDrive',
    mutationTypeName: 'ride.command.complete',
    safety: 'critical',
  },
  submitRating: {
    commandType: 'ride.rating.submit',
    routeName: 'submitRating',
    priority: 'low',
    collapsible: false,
    requiresOnline: true,
    requiresIdempotencyKey: true,
    requiresActorCapability: 'canViewCustomerTrips',
    mutationTypeName: 'ride.command.rating',
    safety: 'safe',
  },
};

function hasKey<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return key in value;
}

function isRequestRideCommand(command: RideLifecycleCommand): command is RequestRideCommand {
  return hasKey(command.payload, 'pickup') && hasKey(command.payload, 'destination') && hasKey(command.payload, 'vehicleType');
}

function isCancelRideCommand(command: RideLifecycleCommand): command is CancelRideCommand {
  return hasKey(command.payload, 'reason') && !hasKey(command.payload, 'driverId') && !hasKey(command.payload, 'startedAt') && !hasKey(command.payload, 'completedAt');
}

function isAcceptRideCommand(command: RideLifecycleCommand): command is AcceptRideCommand {
  return command.idempotencyKey.includes(':accept:') || (
    hasKey(command.payload, 'driverId') &&
    (hasKey(command.payload, 'vehicleId') || hasKey(command.payload, 'acceptedFare'))
  );
}

function isDeclineRideCommand(command: RideLifecycleCommand): command is DeclineRideCommand {
  return command.idempotencyKey.includes(':decline:') || (
    hasKey(command.payload, 'driverId') &&
    hasKey(command.payload, 'reason') &&
    !hasKey(command.payload, 'vehicleId') &&
    !hasKey(command.payload, 'acceptedFare')
  );
}

function isStartRideCommand(command: RideLifecycleCommand): command is StartRideCommand {
  return hasKey(command.payload, 'startedAt');
}

function isCompleteRideCommand(command: RideLifecycleCommand): command is CompleteRideCommand {
  return hasKey(command.payload, 'completedAt');
}

function isSubmitRatingCommand(command: RideLifecycleCommand): command is SubmitRatingCommand {
  return hasKey(command.payload, 'rating');
}

export function inferRideCommandRoute(command: RideLifecycleCommand): RideCommandRoute {
  if (isRequestRideCommand(command)) return rideCommandRoutes.requestRide;
  if (isAcceptRideCommand(command)) return rideCommandRoutes.acceptRide;
  if (isDeclineRideCommand(command)) return rideCommandRoutes.declineRide;
  if (isStartRideCommand(command)) return rideCommandRoutes.startRide;
  if (isCompleteRideCommand(command)) return rideCommandRoutes.completeRide;
  if (isSubmitRatingCommand(command)) return rideCommandRoutes.submitRating;
  if (isCancelRideCommand(command)) return rideCommandRoutes.cancelRide;
  return rideCommandRoutes.cancelRide;
}

export function createRideCommandRoute(command: RideLifecycleCommand) {
  const route = inferRideCommandRoute(command);
  return {
    ...route,
    priority: getRideCommandPriority(route.routeName),
    safety: getRideCommandSafety(route.routeName),
  };
}

export function toOfflineMutationPreview<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  route: RideCommandRoute,
  now: () => Date = () => new Date(),
): RideOfflineMutationPreview<TCommand> {
  return {
    id: command.commandId,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    correlationId: command.correlationId,
    actorId: command.actorId,
    actorRole: command.actorRole,
    type: route.mutationTypeName,
    commandType: route.commandType,
    payload: command.payload,
    priority: route.priority,
    retryPolicy: DEFAULT_RETRY_POLICY,
    collapseStrategy: 'none',
    collapseKey: null,
    expiresAt: new Date(now().getTime() + defaultExpirationMs).toISOString(),
  };
}
