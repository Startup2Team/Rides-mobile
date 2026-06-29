import React, { useMemo } from 'react';
import { useRide } from '@/context/RideContext';
import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { compareRideDualReadModels } from '../dualRead/rideDualReadComparator';
import type { RideDualReadComparison, RideReadModelSource } from '../dualRead/rideDualReadTypes';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import {
  getRideProjectionFeatureFlags,
  selectRideProjectionSource,
  type RideProjectionPolicyResult,
} from './projectionPolicies';
import {
  createRideProjectionSelection,
  type RideProjectionSelectionInput,
  type RideProjectionSelectionResult,
} from './projectionSelection';
import type {
  RideProjectionDiagnostics,
  RideProjectionFeatureFlags,
  RideProjectionLiveSnapshot,
  RideProjectionProjectedSnapshot,
  RideProjectionSnapshot,
  RideProjectionSelectionKind,
} from './projectionTypes';

let forcedLive = false;

function createProjectedSnapshot(snapshot: RideShadowSnapshot | null | undefined): RideProjectionProjectedSnapshot | null {
  if (!snapshot?.enabled || !snapshot.running) return null;
  return {
    activeRide: snapshot.shadowActiveRide,
    rideHistory: [...snapshot.shadowRideHistory],
    driverRequests: [...snapshot.shadowDriverRequests],
  };
}

function createComparison(
  live: RideProjectionLiveSnapshot,
  projected: RideProjectionProjectedSnapshot | null,
): RideDualReadComparison | null {
  if (!projected) return null;
  return compareRideDualReadModels(live, projected);
}

function toReadModelSource(source: RideProjectionSelectionKind): RideReadModelSource {
  return source === 'PROJECTED' ? 'projected' : 'live';
}

function recordSelectionTelemetry(
  selection: RideProjectionSelectionResult,
  comparison: RideDualReadComparison | null,
  rollback: boolean,
  projectedAvailable: boolean,
) {
  observability.metrics.counter('ride.projection.source', 1, {
    source: selection.source,
  });
  observability.logger.info('RideProjectionSourceSelected', {
    source: selection.source,
    reason: selection.reason,
    projectedAvailable,
  });

  if (rollback) {
    observability.metrics.counter('ride.projection.rollback', 1);
    observability.logger.info('RideProjectionRollbackToLive', {
      source: selection.source,
    });
  }

  if (!comparison) {
    observability.metrics.counter('ride.projection.projected_unavailable', 1);
    return;
  }

  observability.metrics.counter('ride.projection.compared', 1, {
    source: selection.source,
  });

  if (comparison.activeRideDiff.length > 0) {
    observability.metrics.counter('ride.projection.active_mismatch', 1);
  }
  if (comparison.historyDiff.length > 0) {
    observability.metrics.counter('ride.projection.history_mismatch', 1);
  }
  if (comparison.driverRequestDiff.length > 0) {
    observability.metrics.counter('ride.projection.driver_request_mismatch', 1);
  }
  if (comparison.mismatch) {
    observability.metrics.counter('ride.projection.mismatch', 1);
    observability.logger.warn('RideProjectionMismatch', {
      aggregateId: comparison.mismatch.aggregateId,
      eventId: comparison.mismatch.eventId,
      eventType: comparison.mismatch.eventType,
      correlationId: comparison.mismatch.correlationId,
      sequenceNumber: comparison.mismatch.sequenceNumber,
      fieldDiff: comparison.mismatch.fieldDiff,
    });
  }
}

export class RideProjectionCoordinator {
  private lastSelection: RideProjectionSelectionResult | null = null;
  private lastComparison: RideDualReadComparison | null = null;
  private comparisonCount = 0;
  private mismatchCount = 0;
  private lastMismatch: RideDualReadComparison['mismatch'] = null;

  getFeatureFlags(): RideProjectionFeatureFlags {
    return getRideProjectionFeatureFlags();
  }

  isLiveForced() {
    return forcedLive;
  }

  resolveSelection(
    projectedAvailable: boolean,
    options: Partial<RideProjectionSelectionInput> = {},
  ): RideProjectionSelectionResult {
    return createRideProjectionSelection({
      projectedAvailable,
      forceLive: options.forceLive ?? forcedLive,
      shadowOnly: options.shadowOnly,
    });
  }

  rollbackToLive(live?: RideProjectionLiveSnapshot, shadowSnapshot?: RideShadowSnapshot | null) {
    forcedLive = true;
    if (!live) {
      const diagnostics = this.getDiagnosticsSnapshot();
      recordSelectionTelemetry(diagnostics.selection, diagnostics.comparison, true, diagnostics.projectedAvailable);
      return diagnostics;
    }

    return this.createSnapshot(live, shadowSnapshot, { forceLive: true });
  }

  createSnapshot(
    live: RideProjectionLiveSnapshot,
    shadowSnapshot: RideShadowSnapshot | null | undefined,
    options: { forceLive?: boolean; shadowOnly?: boolean } = {},
  ): RideProjectionSnapshot {
    const projected = createProjectedSnapshot(shadowSnapshot);
    const projectedAvailable = Boolean(projected);
    const selection = this.resolveSelection(projectedAvailable, options);
    const comparison = createComparison(live, projected);
    const rollback = Boolean(options.forceLive ?? forcedLive);

    this.lastSelection = selection;
    this.lastComparison = comparison;
    this.comparisonCount += comparison ? 1 : 0;
    this.mismatchCount += comparison?.mismatch ? 1 : 0;
    this.lastMismatch = comparison?.mismatch ?? this.lastMismatch;

    recordSelectionTelemetry(selection, comparison, rollback, projectedAvailable);

    return {
      enabled: this.getFeatureFlags().enableProjectionCoordination,
      flags: this.getFeatureFlags(),
      source: toReadModelSource(selection.source),
      selection,
      projectedAvailable,
      live: {
        activeRide: live.activeRide,
        rideHistory: live.rideHistory,
        driverRequests: live.driverRequests,
      },
      projected,
      comparison,
      fallbackToLive: selection.source !== 'PROJECTED',
      comparisonCount: this.comparisonCount,
      mismatchCount: this.mismatchCount,
      lastMismatch: this.lastMismatch,
      lastProjection: this.lastSelection,
      currentSource: selection.source,
    };
  }

  getDiagnosticsSnapshot(): RideProjectionSnapshot {
    const selection = this.lastSelection ?? this.resolveSelection(false, { forceLive: true });
    return {
      enabled: this.getFeatureFlags().enableProjectionCoordination,
      flags: this.getFeatureFlags(),
      source: toReadModelSource(selection.source),
      selection,
      projectedAvailable: false,
      live: { activeRide: null, rideHistory: [], driverRequests: [] },
      projected: null,
      comparison: this.lastComparison,
      fallbackToLive: true,
      comparisonCount: this.comparisonCount,
      mismatchCount: this.mismatchCount,
      lastMismatch: this.lastMismatch,
      lastProjection: this.lastSelection,
      currentSource: selection.source,
    };
  }

  reset() {
    forcedLive = false;
    this.lastSelection = null;
    this.lastComparison = null;
    this.comparisonCount = 0;
    this.mismatchCount = 0;
    this.lastMismatch = null;
  }
}

export const rideProjectionCoordinator = new RideProjectionCoordinator();

export function useProjectionCoordinator(): RideProjectionSnapshot {
  const ride = useRide();
  const shadowSnapshot = rideShadowProjectionManager.getSnapshot();

  return useMemo(() => rideProjectionCoordinator.createSnapshot({
    activeRide: ride.currentRide,
    rideHistory: ride.rideHistory,
    driverRequests: ride.pendingRequest ? [ride.pendingRequest] : [],
  }, shadowSnapshot), [ride.currentRide, ride.rideHistory, ride.pendingRequest, shadowSnapshot]);
}

export function useRideProjectionDiagnostics(): RideProjectionDiagnostics {
  const snapshot = useProjectionCoordinator();
  return {
    comparisonCount: snapshot.comparisonCount,
    mismatchCount: snapshot.mismatchCount,
    lastMismatch: snapshot.lastMismatch,
    lastProjection: snapshot.lastProjection,
    currentSource: snapshot.currentSource,
  };
}

export function getRideProjectionPolicyResult(
  projectedAvailable: boolean,
  options: Partial<RideProjectionSelectionInput> = {},
): RideProjectionPolicyResult {
  return selectRideProjectionSource({
    projectedAvailable,
    forceLive: options.forceLive ?? forcedLive,
    shadowOnly: options.shadowOnly,
  });
}
