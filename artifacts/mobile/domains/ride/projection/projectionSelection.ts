import type { RideProjectionSelectionKind } from './projectionTypes';
import { selectRideProjectionSource } from './projectionPolicies';

export interface RideProjectionSelectionResult {
  source: RideProjectionSelectionKind;
  reason: string;
  projectedAvailable: boolean;
  forcedLive: boolean;
}

export interface RideProjectionSelectionInput {
  projectedAvailable: boolean;
  forceLive?: boolean;
  shadowOnly?: boolean;
}

export function createRideProjectionSelection(input: RideProjectionSelectionInput): RideProjectionSelectionResult {
  const result = selectRideProjectionSource(input);
  return {
    source: result.source,
    reason: result.reason,
    projectedAvailable: input.projectedAvailable,
    forcedLive: Boolean(input.forceLive),
  };
}
