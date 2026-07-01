import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import {
  recordRideCanaryFallback,
  recordRideCanaryMappingFailure,
  recordRideCanaryProjectionUnavailable,
  recordRideDetailParity,
} from '../canary/canaryHealth';
import type { RideDualReadComparison } from '../dualRead/rideDualReadTypes';
import { compareRideHistory } from '../dualRead/rideDualReadComparator';
import { createRideDualReadComparison } from '../dualRead/rideDualReadTypes';
import type { RideHistoryReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import { rideProjectionCoordinator } from './projectionCoordinator';
import { ENABLE_PROJECTED_RIDE_DETAIL_CANARY } from './projectionTypes';
import { USE_PROJECTED_RIDE_READ_MODEL } from '../dualRead/rideDualReadTypes';
import { mapProjectedRideHistoryEntry } from './rideReadModelCanaryMappers';

export interface RideDetailCanaryOptions {
  canaryEnabled?: boolean;
  useProjectedRideReadModel?: boolean;
  shadowSnapshot?: RideShadowSnapshot | null;
}

export interface RideDetailCanaryResult {
  source: 'live' | 'projected';
  detail: Ride | null;
  projectedAvailable: boolean;
  fallback: boolean;
  comparison: RideDualReadComparison | null;
}

function selectProjectedRideDetail(
  liveRide: Ride | null,
  rideId: string,
  projectedHistory: RideHistoryReadModel[] | null | undefined,
): RideHistoryReadModel | null {
  if (!liveRide || !projectedHistory) return null;
  return projectedHistory.find(entry => entry.rideId === rideId) ?? null;
}

export function resolveProjectedRideDetail(
  liveRide: Ride | null,
  rideId: string,
  options: RideDetailCanaryOptions = {},
): RideDetailCanaryResult {
  const canaryEnabled = options.canaryEnabled ?? ENABLE_PROJECTED_RIDE_DETAIL_CANARY;
  const useProjectedRideReadModel = options.useProjectedRideReadModel ?? USE_PROJECTED_RIDE_READ_MODEL;

  if (!canaryEnabled || !useProjectedRideReadModel) {
    return {
      source: 'live',
      detail: liveRide,
      projectedAvailable: false,
      fallback: false,
      comparison: null,
    };
  }

  observability.metrics.counter('ride.detail.canary.enabled', 1);
  observability.logger.info('RideDetailCanaryEnabled', {
    rideId,
    canaryEnabled,
    useProjectedRideReadModel,
  });

  try {
    if (!liveRide) {
      observability.metrics.counter('ride.detail.source_selected', 1, { source: 'live' });
      observability.logger.info('RideDetailSourceSelected', { rideId, source: 'live' });
      observability.metrics.counter('ride.detail.fallback', 1);
      recordRideCanaryFallback('detail', 'live-detail-unavailable');
      observability.logger.info('RideDetailFallback', { rideId, reason: 'live-detail-unavailable' });
      return {
        source: 'live',
        detail: null,
        projectedAvailable: false,
        fallback: true,
        comparison: null,
      };
    }

    const shadowSnapshot = options.shadowSnapshot ?? rideShadowProjectionManager.getSnapshot();
    const historyOnlyShadowSnapshot = {
      ...shadowSnapshot,
      shadowActiveRide: null,
      shadowDriverRequests: [],
    };
    const projectionSnapshot = rideProjectionCoordinator.createSnapshot(
      {
        activeRide: null,
        rideHistory: [liveRide],
        driverRequests: [],
      },
      historyOnlyShadowSnapshot,
    );
    const projectedRide = selectProjectedRideDetail(liveRide, rideId, projectionSnapshot.projected?.rideHistory);
    const historyDiff = projectedRide ? compareRideHistory([liveRide], [projectedRide]) : null;
    const comparison = historyDiff ? createRideDualReadComparison([], historyDiff, []) : null;

    observability.metrics.counter('ride.detail.comparison', 1, {
      projectedAvailable: String(Boolean(projectedRide)),
    });
    observability.logger.info('RideDetailComparison', {
      rideId,
      projectedAvailable: Boolean(projectedRide),
      historyDiffCount: comparison?.historyDiff.length ?? 0,
      mismatch: Boolean(comparison?.mismatch),
    });

    if (!projectedRide) {
      recordRideCanaryProjectionUnavailable('detail');
    }

    if (projectedRide) {
      const mappedPreview = mapProjectedRideHistoryEntry(liveRide, projectedRide);
      recordRideDetailParity(liveRide, mappedPreview);
    }

    if (comparison?.mismatch) {
      observability.metrics.counter('ride.detail.mismatch', 1);
      observability.logger.warn('RideDetailMismatch', {
        rideId,
        aggregateId: comparison.mismatch.aggregateId,
        eventId: comparison.mismatch.eventId,
        eventType: comparison.mismatch.eventType,
        correlationId: comparison.mismatch.correlationId,
        sequenceNumber: comparison.mismatch.sequenceNumber,
        fieldDiff: comparison.mismatch.fieldDiff,
      });
    }

    if (!projectedRide || comparison?.mismatch) {
      observability.metrics.counter('ride.detail.source_selected', 1, { source: 'live' });
      observability.logger.info('RideDetailSourceSelected', { rideId, source: 'live' });
      observability.metrics.counter('ride.detail.fallback', 1);
      recordRideCanaryFallback('detail', !projectedRide ? 'projected-unavailable' : 'comparison-failure');
      observability.logger.info('RideDetailFallback', {
        rideId,
        reason: !projectedRide ? 'projected-unavailable' : 'comparison-failure',
      });
      return {
        source: 'live',
        detail: liveRide,
        projectedAvailable: Boolean(projectedRide),
        fallback: true,
        comparison,
      };
    }

    const mapped = mapProjectedRideHistoryEntry(liveRide, projectedRide);
    observability.metrics.counter('ride.detail.source_selected', 1, { source: 'projected' });
    observability.logger.info('RideDetailSourceSelected', { rideId, source: 'projected' });

    return {
      source: 'projected',
      detail: mapped,
      projectedAvailable: true,
      fallback: false,
      comparison,
    };
  } catch (error) {
    observability.metrics.counter('ride.detail.mapping_failure', 1);
    recordRideCanaryMappingFailure('detail', 'mapping-failure', error);
    observability.logger.warn('RideDetailMappingFailure', {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    observability.metrics.counter('ride.detail.source_selected', 1, { source: 'live' });
    observability.logger.info('RideDetailSourceSelected', { rideId, source: 'live' });
    observability.metrics.counter('ride.detail.fallback', 1);
    recordRideCanaryFallback('detail', 'mapping-failure');
    observability.logger.info('RideDetailFallback', {
      rideId,
      reason: 'mapping-failure',
    });
    return {
      source: 'live',
      detail: liveRide,
      projectedAvailable: false,
      fallback: true,
      comparison: null,
    };
  }
}
