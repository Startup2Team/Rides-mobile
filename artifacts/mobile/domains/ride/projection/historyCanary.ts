import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import type { RideDualReadComparison } from '../dualRead/rideDualReadTypes';
import type { RideHistoryReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import { rideProjectionCoordinator } from './projectionCoordinator';
import { ENABLE_PROJECTED_HISTORY_CANARY } from './projectionTypes';
import { USE_PROJECTED_RIDE_READ_MODEL } from '../dualRead/rideDualReadTypes';
import { mapProjectedRideHistoryEntry } from './rideReadModelCanaryMappers';

export interface RideHistoryCanaryOptions {
  canaryEnabled?: boolean;
  useProjectedRideReadModel?: boolean;
  shadowSnapshot?: RideShadowSnapshot | null;
}

export interface RideHistoryCanaryResult {
  source: 'live' | 'projected';
  history: Ride[];
  projectedAvailable: boolean;
  fallback: boolean;
  comparison: RideDualReadComparison | null;
}

function mergeRideHistory(liveHistory: Ride[], projectedHistory: RideHistoryReadModel[]) {
  const liveById = new Map(liveHistory.map(ride => [ride.id, ride]));
  const merged = liveHistory.map(ride => {
    const projected = projectedHistory.find(entry => entry.rideId === ride.id);
    return projected ? mapProjectedRideHistoryEntry(ride, projected) : ride;
  });
  const extras = projectedHistory
    .filter(entry => !liveById.has(entry.rideId))
    .map(entry => mapProjectedRideHistoryEntry(undefined, entry));

  return [...merged, ...extras];
}

export function resolveProjectedRideHistory(
  liveHistory: Ride[],
  userId: string,
  options: RideHistoryCanaryOptions = {},
): RideHistoryCanaryResult {
  const canaryEnabled = options.canaryEnabled ?? ENABLE_PROJECTED_HISTORY_CANARY;
  const useProjectedRideReadModel = options.useProjectedRideReadModel ?? USE_PROJECTED_RIDE_READ_MODEL;

  if (!canaryEnabled || !useProjectedRideReadModel) {
    return {
      source: 'live',
      history: liveHistory,
      projectedAvailable: false,
      fallback: false,
      comparison: null,
    };
  }

  observability.metrics.counter('ride.history.canary.enabled', 1);
  observability.logger.info('RideHistoryCanaryEnabled', {
    userId,
    canaryEnabled,
    useProjectedRideReadModel,
  });

  try {
    const shadowSnapshot = options.shadowSnapshot ?? rideShadowProjectionManager.getSnapshot();
    const historyOnlyShadowSnapshot = {
      ...shadowSnapshot,
      shadowActiveRide: null,
      shadowDriverRequests: [],
    };
    const projectionSnapshot = rideProjectionCoordinator.createSnapshot(
      {
        activeRide: null,
        rideHistory: liveHistory,
        driverRequests: [],
      },
      historyOnlyShadowSnapshot,
    );
    const projectedHistory = projectionSnapshot.projected?.rideHistory ?? null;
    const comparison = projectionSnapshot.comparison;

    observability.metrics.counter('ride.history.comparison', 1, {
      projectedAvailable: String(Boolean(projectedHistory)),
    });
    observability.logger.info('RideHistoryComparison', {
      userId,
      projectedAvailable: Boolean(projectedHistory),
      historyDiffCount: comparison?.historyDiff.length ?? 0,
      mismatch: Boolean(comparison?.mismatch),
    });

    if (comparison?.mismatch) {
      observability.metrics.counter('ride.history.mismatch', 1);
      observability.logger.warn('RideHistoryMismatch', {
        userId,
        aggregateId: comparison.mismatch.aggregateId,
        eventId: comparison.mismatch.eventId,
        eventType: comparison.mismatch.eventType,
        correlationId: comparison.mismatch.correlationId,
        sequenceNumber: comparison.mismatch.sequenceNumber,
      });
    }

    if (!projectedHistory || comparison?.mismatch) {
      observability.metrics.counter('ride.history.source_selected', 1, {
        source: 'live',
      });
      observability.logger.info('RideHistorySourceSelected', {
        userId,
        source: 'live',
      });
      observability.metrics.counter('ride.history.fallback', 1);
      observability.logger.info('RideHistoryFallback', {
        userId,
        reason: !projectedHistory ? 'projected-unavailable' : 'comparison-failure',
      });
      return {
        source: 'live',
        history: liveHistory,
        projectedAvailable: Boolean(projectedHistory),
        fallback: true,
        comparison,
      };
    }

    observability.metrics.counter('ride.history.source_selected', 1, {
      source: 'projected',
    });
    observability.logger.info('RideHistorySourceSelected', {
      userId,
      source: 'projected',
    });

    return {
      source: 'projected',
      history: mergeRideHistory(liveHistory, projectedHistory),
      projectedAvailable: true,
      fallback: false,
      comparison,
    };
  } catch (error) {
    observability.metrics.counter('ride.history.source_selected', 1, {
      source: 'live',
    });
    observability.logger.info('RideHistorySourceSelected', {
      userId,
      source: 'live',
    });
    observability.metrics.counter('ride.history.fallback', 1);
    observability.logger.warn('RideHistoryFallback', {
      userId,
      reason: 'projection-error',
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      source: 'live',
      history: liveHistory,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
    };
  }
}
