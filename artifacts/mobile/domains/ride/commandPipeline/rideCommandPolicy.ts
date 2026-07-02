import type { CapabilityName, CapabilitySnapshot } from '@/capabilities';
import type { RideLifecycleCommand } from '../commands';
import type { RideCommandPolicyResult, RideCommandRoute, RideCommandSafety } from './rideCommandTypes';

export interface RideCommandPolicyContext {
  capabilitySnapshot?: CapabilitySnapshot | null;
}

type RouteKey = RideCommandRoute['routeName'];

const routeSafety: Record<RouteKey, RideCommandSafety> = {
  requestRide: 'guarded',
  cancelRide: 'guarded',
  acceptRide: 'critical',
  declineRide: 'guarded',
  startRide: 'critical',
  completeRide: 'critical',
  submitRating: 'safe',
};

const routePriority: Record<RouteKey, RideCommandRoute['priority']> = {
  requestRide: 'high',
  cancelRide: 'critical',
  acceptRide: 'critical',
  declineRide: 'normal',
  startRide: 'critical',
  completeRide: 'critical',
  submitRating: 'low',
};

const routeCapability: Record<RouteKey, CapabilityName | null> = {
  requestRide: 'canBookRide',
  cancelRide: 'canBookRide',
  acceptRide: 'canDrive',
  declineRide: 'canDrive',
  startRide: 'canDrive',
  completeRide: 'canDrive',
  submitRating: 'canViewCustomerTrips',
};

export function getRideCommandSafety(routeName: RouteKey) {
  return routeSafety[routeName];
}

export function getRideCommandPriority(routeName: RouteKey) {
  return routePriority[routeName];
}

export function getRideCommandCapability(routeName: RouteKey) {
  return routeCapability[routeName];
}

export function isRideCommandAllowed(
  routeName: RouteKey,
  command: RideLifecycleCommand,
  context: RideCommandPolicyContext = {},
): RideCommandPolicyResult {
  const requiredCapability = getRideCommandCapability(routeName);
  const capabilitySnapshot = context.capabilitySnapshot ?? null;
  const capabilities = capabilitySnapshot?.capabilities ?? null;
  const state = capabilitySnapshot?.state ?? null;
  const payload = command.payload as unknown as Record<string, unknown>;

  if (routeName === 'cancelRide') {
    const reason = payload.reason as string | undefined;
    if (command.actorRole === 'system' || reason === 'system_cancelled') {
      return { allowed: command.actorRole === 'system', reason: command.actorRole === 'system' ? 'allowed' : 'system-role-required', requiredCapability: null };
    }
    if (reason === 'driver_cancelled') {
      const allowed = command.actorRole === 'driver' && Boolean(capabilities?.canDrive && state?.isApprovedDriver);
      return { allowed, reason: allowed ? 'allowed' : 'driver-capability-required', requiredCapability };
    }
    return {
      allowed: command.actorRole === 'customer',
      reason: command.actorRole === 'customer' ? 'allowed' : 'customer-role-required',
      requiredCapability,
    };
  }

  if (routeName === 'requestRide') {
    const allowed = command.actorRole === 'customer' && Boolean(capabilities?.canBookRide ?? true);
    return {
      allowed,
      reason: allowed ? 'allowed' : 'customer-capability-required',
      requiredCapability,
    };
  }

  if (routeName === 'submitRating') {
    const allowed = command.actorRole === 'customer' || command.actorRole === 'driver';
    return {
      allowed,
      reason: allowed ? 'allowed' : 'actor-role-required',
      requiredCapability,
    };
  }

  const allowed = command.actorRole === 'driver' && Boolean(capabilities?.canDrive && state?.isApprovedDriver);
  return {
    allowed,
    reason: allowed ? 'allowed' : 'driver-capability-required',
    requiredCapability,
  };
}
