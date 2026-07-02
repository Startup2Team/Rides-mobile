import React, { useEffect, useMemo, useRef } from 'react';
import { useRide } from '@/context/RideContext';
import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import { resolveProjectedActiveRide } from '../projection/activeRideCanary';
import { createActiveRideUiSummary, mapProjectedActiveRideToRideLike } from '../projection/activeRideUiModel';
import {
  rideProjectionCoordinator,
  useProjectionCoordinator,
} from '../projection';
import type {
  RideDualReadLiveSnapshot,
  RideDualReadProjectedSnapshot,
  RideDualReadSlice,
  RideDualReadSnapshot,
  RideReadModelSource,
} from './rideDualReadTypes';
import { ENABLE_RIDE_DUAL_READ, USE_PROJECTED_RIDE_READ_MODEL } from './rideDualReadTypes';
import type { ActiveRideUiSummary } from '../projection/activeRideUiModel';

export interface ActiveRideUiReadModelSlice extends Omit<RideDualReadSlice<Ride | null, ActiveRideReadModel | null>, 'comparison'> {
  selected: Ride | null;
  summary: ActiveRideUiSummary;
  fallback: boolean;
  readinessDenied: boolean;
  comparison: ReturnType<typeof resolveProjectedActiveRide>['comparison'];
}

export function getLiveActiveRide(live: Ride | null | undefined) {
  return live ?? null;
}

export function getProjectedActiveRide(snapshot: RideShadowSnapshot | null | undefined) {
  return snapshot?.shadowActiveRide ?? null;
}

export function getLiveRideHistory(live: Ride[] | null | undefined) {
  return live ?? [];
}

export function getProjectedRideHistory(snapshot: RideShadowSnapshot | null | undefined) {
  return [...(snapshot?.shadowRideHistory ?? [])];
}

export function getLiveDriverRequests(live: Ride[] | null | undefined) {
  return live ?? [];
}

export function getProjectedDriverRequests(snapshot: RideShadowSnapshot | null | undefined) {
  return [...(snapshot?.shadowDriverRequests ?? [])];
}

export function getReadModelSource(options: { projectedAvailable?: boolean } = {}): RideReadModelSource {
  return rideProjectionCoordinator.resolveSelection(Boolean(options.projectedAvailable)).source === 'PROJECTED'
    ? 'projected'
    : 'live';
}

export function forceLiveRideReadModel() {
  rideProjectionCoordinator.rollbackToLive();
  return 'live' as const;
}

export function assertProjectedReadDisabledInProduction() {
  if (process.env.NODE_ENV === 'production' && USE_PROJECTED_RIDE_READ_MODEL) {
    throw new Error('Projected ride read models must remain disabled in production.');
  }
  return true;
}

function mapProjectionSnapshot(snapshot: ReturnType<typeof useProjectionCoordinator>): RideDualReadSnapshot {
  return {
    enabled: snapshot.enabled,
    source: snapshot.source,
    projectedAvailable: snapshot.projectedAvailable,
    live: snapshot.live,
    projected: snapshot.projected,
    comparison: snapshot.comparison,
  };
}

export function createRideDualReadSnapshot(
  live: RideDualReadLiveSnapshot,
  shadowSnapshot: RideShadowSnapshot | null | undefined,
): RideDualReadSnapshot {
  return mapProjectionSnapshot(rideProjectionCoordinator.createSnapshot(live, shadowSnapshot));
}

export function useRideReadModel(): RideDualReadSnapshot {
  const snapshot = useProjectionCoordinator();
  return useMemo(() => mapProjectionSnapshot(snapshot), [snapshot]);
}

export function useActiveRideReadModel(): ActiveRideUiReadModelSlice {
  const ride = useRide();
  const shadowSnapshot = rideShadowProjectionManager.getSnapshot();
  const canaryEnabled = process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY === 'true';
  const useProjectedRideReadModel = process.env.USE_PROJECTED_RIDE_READ_MODEL === 'true';
  const canaryResult = useMemo(() => resolveProjectedActiveRide(ride.currentRide, {
    canaryEnabled,
    useProjectedRideReadModel,
    shadowSnapshot,
  }), [ride.currentRide, shadowSnapshot, canaryEnabled, useProjectedRideReadModel]);

  const selectedRide = useMemo(() => (
    canaryResult.source === 'projected'
      ? mapProjectedActiveRideToRideLike(ride.currentRide, canaryResult.activeRide as ActiveRideReadModel | null)
      : ride.currentRide
  ), [canaryResult.activeRide, canaryResult.source, ride.currentRide]);

  const summary = useMemo(() => createActiveRideUiSummary(
    selectedRide,
    canaryResult.source === 'projected' ? canaryResult.activeRide as ActiveRideReadModel | null : null,
    canaryResult.source,
  ), [canaryResult.activeRide, canaryResult.source, selectedRide]);

  const telemetryRef = useRef<string | null>(null);
  useEffect(() => {
    const telemetryKey = [
      canaryResult.source,
      canaryResult.fallback ? 'fallback' : 'selected',
      canaryResult.stale ? 'stale' : 'fresh',
      canaryResult.readinessDenied ? 'denied' : 'ready',
      summary.phaseLabel,
      summary.statusLabel,
    ].join('|');

    if (telemetryRef.current === telemetryKey) return;
    telemetryRef.current = telemetryKey;

    observability.metrics.counter('ride.active.ui.source_selected', 1, {
      source: canaryResult.source,
      fallback: String(canaryResult.fallback),
    });
    observability.logger.info('RideActiveRideUiSourceSelected', {
      source: canaryResult.source,
      fallback: canaryResult.fallback,
      stale: canaryResult.stale,
      readinessDenied: canaryResult.readinessDenied,
    });

    if (canaryResult.source === 'projected') {
      observability.metrics.counter('ride.active.ui.projected_enabled', 1);
      observability.logger.info('RideActiveRideUiProjectedEnabled', {
        source: canaryResult.source,
        phaseLabel: summary.phaseLabel,
      });
      return;
    }

    observability.metrics.counter('ride.active.ui.live_fallback', 1, {
      reason: canaryResult.readinessDenied ? 'readiness-denied' : canaryResult.stale ? 'stale' : canaryResult.fallback ? 'fallback' : 'live',
    });
    observability.logger.info('RideActiveRideUiLiveFallback', {
      source: canaryResult.source,
      reason: canaryResult.readinessDenied ? 'readiness-denied' : canaryResult.stale ? 'stale' : canaryResult.fallback ? 'fallback' : 'live',
    });

    if (rideProjectionCoordinator.isLiveForced()) {
      observability.metrics.counter('ride.active.ui.rollback_used', 1);
      observability.logger.warn('RideActiveRideUiRollbackUsed', {
        source: canaryResult.source,
      });
    }

    const blockedByGate =
      canaryEnabled
      && useProjectedRideReadModel
      && canaryResult.source === 'live'
      && canaryResult.projectedAvailable
      && !canaryResult.stale
      && (!canaryResult.comparison || canaryResult.comparison.length === 0)
      && !canaryResult.readinessDenied;

    if (blockedByGate) {
      observability.metrics.counter('ride.active.ui.projection_blocked_by_gate', 1);
      observability.logger.warn('RideActiveRideUiProjectionBlockedByGate', {
        source: canaryResult.source,
        reason: 'rollout-gate-blocked',
      });
    }
  }, [canaryResult.comparison, canaryResult.fallback, canaryResult.projectedAvailable, canaryResult.readinessDenied, canaryResult.source, canaryResult.stale, canaryEnabled, selectedRide, summary.phaseLabel, summary.statusLabel, useProjectedRideReadModel]);

  return {
    enabled: ENABLE_RIDE_DUAL_READ,
    source: canaryResult.source,
    projectedAvailable: canaryResult.projectedAvailable,
    live: ride.currentRide,
    projected: canaryResult.activeRide && canaryResult.source === 'projected' ? canaryResult.activeRide as ActiveRideReadModel : null,
    comparison: canaryResult.comparison,
    selected: selectedRide,
    summary,
    fallback: canaryResult.fallback,
    readinessDenied: canaryResult.readinessDenied,
  };
}

export function useRideHistoryReadModel(): RideDualReadSlice<Ride[], RideHistoryReadModel[]> {
  const snapshot = useRideReadModel();
  return {
    enabled: snapshot.enabled,
    source: snapshot.source,
    projectedAvailable: snapshot.projectedAvailable,
    live: snapshot.live.rideHistory,
    projected: snapshot.projected?.rideHistory ?? null,
    comparison: snapshot.comparison,
  };
}

export function useDriverRequestsReadModel(): RideDualReadSlice<Ride[], DriverRideRequestReadModel[]> {
  const snapshot = useRideReadModel();
  return {
    enabled: snapshot.enabled,
    source: snapshot.source,
    projectedAvailable: snapshot.projectedAvailable,
    live: snapshot.live.driverRequests,
    projected: snapshot.projected?.driverRequests ?? null,
    comparison: snapshot.comparison,
  };
}

function RideDualReadDiagnosticsEnabled() {
  useRideReadModel();
  return null;
}

export function RideDualReadDiagnostics() {
  if (!ENABLE_RIDE_DUAL_READ) return null;
  return React.createElement(RideDualReadDiagnosticsEnabled);
}
