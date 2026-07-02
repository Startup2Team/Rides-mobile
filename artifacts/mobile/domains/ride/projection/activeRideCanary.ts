import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { compareActiveRide } from '../dualRead/rideDualReadComparator';
import type { ActiveRideReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import { isReadyForActiveRideCanary } from '../canary/canaryHealth';
import {
  emitRideActiveRideComparisonTelemetry,
  emitRideActiveRideFallbackTelemetry,
  emitRideActiveRideMappingFailureTelemetry,
  emitRideActiveRideMismatchTelemetry,
  emitRideActiveRideProjectionStaleTelemetry,
  emitRideActiveRideReadinessDeniedTelemetry,
  emitRideActiveRideSourceSelectedTelemetry,
} from '../canary/canaryMetrics';
import { mapProjectedActiveRideReadModel } from './activeRideReadModelMapper';
import { evaluateActiveRideRolloutGate } from './activeRideRolloutGate';
import { ENABLE_PROJECTED_ACTIVE_RIDE_CANARY } from './projectionTypes';
import { USE_PROJECTED_RIDE_READ_MODEL } from '../dualRead/rideDualReadTypes';

export interface ActiveRideCanaryOptions {
  canaryEnabled?: boolean;
  useProjectedRideReadModel?: boolean;
  shadowSnapshot?: RideShadowSnapshot | null;
}

export interface ActiveRideCanaryResult {
  source: 'live' | 'projected';
  activeRide: Ride | ActiveRideReadModel | null;
  projectedAvailable: boolean;
  fallback: boolean;
  comparison: ReturnType<typeof compareActiveRide> | null;
  stale: boolean;
  readinessDenied: boolean;
}

function hasRequiredRoute(ride: ActiveRideReadModel | null | undefined) {
  return Boolean(
    ride
    && ride.pickup
    && ride.destination
    && typeof ride.pickup.address === 'string'
    && typeof ride.destination.address === 'string',
  );
}

function isMissingExpectedDriverEta(liveRide: Ride | null, projectedRide: ActiveRideReadModel | null) {
  return Boolean(
    liveRide?.driver
    && typeof liveRide.driver.eta === 'number'
    && projectedRide
    && projectedRide.etaMinutes == null,
  );
}

function detectStaleness(
  liveRide: Ride | null,
  projectedRide: ActiveRideReadModel | null,
  shadowSnapshot: RideShadowSnapshot,
) {
  if (!projectedRide) {
    return { stale: false, reason: 'projection-unavailable' };
  }

  const lastSequenceNumber = shadowSnapshot.lastProcessedEvent?.sequenceNumber ?? projectedRide.sequenceNumber;
  if (projectedRide.sequenceNumber < lastSequenceNumber) {
    return { stale: true, reason: 'sequence-behind-live' };
  }

  const lastTimestamp = shadowSnapshot.lastProcessedEvent?.timestamp;
  if (lastTimestamp && new Date(projectedRide.updatedAt).getTime() < new Date(lastTimestamp).getTime()) {
    return { stale: true, reason: 'projection-timestamp-stale' };
  }

  if (!projectedRide.status || !projectedRide.phase) {
    return { stale: true, reason: 'missing-lifecycle-state' };
  }

  if (liveRide && (liveRide.driverId || liveRide.driver) && !projectedRide.driver?.userId) {
    return { stale: true, reason: 'missing-driver-assignment' };
  }

  if (!hasRequiredRoute(projectedRide)) {
    return { stale: true, reason: 'missing-route' };
  }

  if (isMissingExpectedDriverEta(liveRide, projectedRide)) {
    return { stale: true, reason: 'missing-eta' };
  }

  return { stale: false, reason: null as string | null };
}

export function resolveProjectedActiveRide(
  liveRide: Ride | null,
  options: ActiveRideCanaryOptions = {},
): ActiveRideCanaryResult {
  const canaryEnabled = options.canaryEnabled ?? ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
  const useProjectedRideReadModel = options.useProjectedRideReadModel ?? USE_PROJECTED_RIDE_READ_MODEL;

  if (!canaryEnabled || !useProjectedRideReadModel) {
    emitRideActiveRideReadinessDeniedTelemetry({ reason: 'feature-disabled' });
    emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
    emitRideActiveRideFallbackTelemetry({ reason: 'feature-disabled' });
    return {
      source: 'live',
      activeRide: liveRide,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
      stale: false,
      readinessDenied: true,
    };
  }

  if (!isReadyForActiveRideCanary()) {
    emitRideActiveRideReadinessDeniedTelemetry({ reason: 'health-gate' });
    emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
    emitRideActiveRideFallbackTelemetry({ reason: 'health-gate' });
    return {
      source: 'live',
      activeRide: liveRide,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
      stale: false,
      readinessDenied: true,
    };
  }

  observability.metrics.counter('ride.active.canary.enabled', 1);
  observability.logger.info('RideActiveRideCanaryEnabled', {
    canaryEnabled,
    useProjectedRideReadModel,
  });

  const shadowSnapshot = options.shadowSnapshot ?? rideShadowProjectionManager.getSnapshot();
  if (!shadowSnapshot.enabled || !shadowSnapshot.running) {
    evaluateActiveRideRolloutGate({
      canaryEnabled,
      useProjectedRideReadModel,
      projectedAvailable: false,
      fallback: true,
      stale: false,
      matched: false,
      mappingFailure: false,
      unresolvedProjectionError: false,
      comparisonTimestamp: null,
    });
    emitRideActiveRideComparisonTelemetry({
      projectedAvailable: false,
      stale: false,
      reason: 'projection-unavailable',
    });
    emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
    emitRideActiveRideFallbackTelemetry({ reason: 'projection-unavailable' });
    return {
      source: 'live',
      activeRide: liveRide,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
      stale: false,
      readinessDenied: false,
    };
  }

  try {
    const projectedRide = mapProjectedActiveRideReadModel(liveRide, shadowSnapshot.shadowActiveRide);
    const projectedAvailable = Boolean(projectedRide);
    const staleness = detectStaleness(liveRide, projectedRide, shadowSnapshot);
    const comparison = projectedRide ? (compareActiveRide(liveRide, projectedRide) ?? []) : null;
    const rolloutStatus = evaluateActiveRideRolloutGate({
      canaryEnabled,
      useProjectedRideReadModel,
      projectedAvailable,
      fallback: !projectedRide || staleness.stale || Boolean(comparison && comparison.length > 0),
      stale: staleness.stale,
      matched: Boolean(comparison && comparison.length === 0),
      mappingFailure: false,
      unresolvedProjectionError: false,
      comparisonTimestamp: projectedRide?.updatedAt ?? null,
    });

    emitRideActiveRideComparisonTelemetry({
      projectedAvailable,
      stale: staleness.stale,
      reason: staleness.reason,
    });

    if (!projectedRide) {
      emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
      emitRideActiveRideFallbackTelemetry({ reason: 'projection-unavailable' });
      return {
        source: 'live',
        activeRide: liveRide,
        projectedAvailable: false,
        fallback: true,
        comparison: null,
        stale: false,
        readinessDenied: false,
      };
    }

    if (staleness.stale) {
      emitRideActiveRideProjectionStaleTelemetry({
        reason: staleness.reason ?? 'stale',
        sequenceNumber: projectedRide.sequenceNumber,
        updatedAt: projectedRide.updatedAt,
      });
      emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
      emitRideActiveRideFallbackTelemetry({ reason: staleness.reason ?? 'stale' });
      return {
        source: 'live',
        activeRide: liveRide,
        projectedAvailable: true,
        fallback: true,
        comparison,
        stale: true,
        readinessDenied: false,
      };
    }

    if (comparison && comparison.length > 0) {
      emitRideActiveRideMismatchTelemetry({ fieldDiffCount: comparison.length });
      emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
      emitRideActiveRideFallbackTelemetry({ reason: 'comparison-failure' });
      return {
        source: 'live',
        activeRide: liveRide,
        projectedAvailable: true,
        fallback: true,
        comparison,
        stale: false,
        readinessDenied: false,
      };
    }

    if (!rolloutStatus.eligible) {
      emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
      emitRideActiveRideFallbackTelemetry({ reason: `rollout-${rolloutStatus.reason}` });
      return {
        source: 'live',
        activeRide: liveRide,
        projectedAvailable: true,
        fallback: true,
        comparison,
        stale: false,
        readinessDenied: false,
      };
    }

    emitRideActiveRideSourceSelectedTelemetry({ source: 'projected' });
    return {
      source: 'projected',
      activeRide: projectedRide,
      projectedAvailable: true,
      fallback: false,
      comparison,
      stale: false,
      readinessDenied: false,
    };
  } catch (error) {
    emitRideActiveRideMappingFailureTelemetry({ reason: 'mapping-failure', error });
    evaluateActiveRideRolloutGate({
      canaryEnabled,
      useProjectedRideReadModel,
      projectedAvailable: false,
      fallback: true,
      stale: false,
      matched: false,
      mappingFailure: true,
      unresolvedProjectionError: true,
      comparisonTimestamp: null,
    });
    emitRideActiveRideSourceSelectedTelemetry({ source: 'live' });
    emitRideActiveRideFallbackTelemetry({ reason: 'mapping-failure' });
    return {
      source: 'live',
      activeRide: liveRide,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
      stale: false,
      readinessDenied: false,
    };
  }
}
