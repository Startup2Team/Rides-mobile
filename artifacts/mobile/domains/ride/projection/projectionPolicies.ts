import { ENABLE_RIDE_DUAL_READ, USE_PROJECTED_RIDE_READ_MODEL } from '../dualRead/rideDualReadTypes';
import {
  ENABLE_PROJECTED_HISTORY_CANARY,
  ENABLE_PROJECTED_RIDE_DETAIL_CANARY,
  type RideProjectionFeatureFlags,
  type RideProjectionSelectionKind,
} from './projectionTypes';

export interface RideProjectionPolicyInput {
  projectedAvailable: boolean;
  forceLive?: boolean;
  shadowOnly?: boolean;
}

export interface RideProjectionPolicyResult {
  source: RideProjectionSelectionKind;
  reason: string;
}

export function getRideProjectionFeatureFlags(): RideProjectionFeatureFlags {
  return {
    enableProjectionCoordination: ENABLE_RIDE_DUAL_READ,
    enableDualRead: ENABLE_RIDE_DUAL_READ,
    useProjectedRideReadModel: USE_PROJECTED_RIDE_READ_MODEL,
    enableProjectedHistoryCanary: ENABLE_PROJECTED_HISTORY_CANARY,
    enableProjectedRideDetailCanary: ENABLE_PROJECTED_RIDE_DETAIL_CANARY,
  };
}

export function selectRideProjectionSource(input: RideProjectionPolicyInput): RideProjectionPolicyResult {
  if (input.forceLive) {
    return { source: 'LIVE', reason: 'rollback-forced-live' };
  }

  const flags = getRideProjectionFeatureFlags();
  if (!flags.enableProjectionCoordination || !flags.enableDualRead) {
    return { source: 'LIVE', reason: 'coordination-disabled' };
  }

  if (input.shadowOnly) {
    return input.projectedAvailable
      ? { source: 'SHADOW_ONLY', reason: 'shadow-only' }
      : { source: 'UNAVAILABLE', reason: 'shadow-only-unavailable' };
  }

  if (!flags.useProjectedRideReadModel) {
    return { source: 'LIVE', reason: 'projected-cutover-disabled' };
  }

  return input.projectedAvailable
    ? { source: 'PROJECTED', reason: 'projected-cutover-enabled' }
    : { source: 'UNAVAILABLE', reason: 'projected-unavailable' };
}

