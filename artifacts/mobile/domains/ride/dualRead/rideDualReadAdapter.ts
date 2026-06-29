import React, { useEffect, useMemo } from 'react';
import { useRide } from '@/context/RideContext';
import type { Ride } from '@/types';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
import { compareActiveRide, compareDriverRequests, compareRideDualReadModels, compareRideHistory } from './rideDualReadComparator';
import { recordRideDualReadTelemetry } from './rideDualReadMetrics';
import {
  ENABLE_RIDE_DUAL_READ,
  USE_PROJECTED_RIDE_READ_MODEL,
  type RideDualReadLiveSnapshot,
  type RideDualReadProjectedSnapshot,
  type RideDualReadSlice,
  type RideDualReadSnapshot,
  type RideReadModelSource,
} from './rideDualReadTypes';

let liveReadModelForced = false;

function normalizeDriverRequests(live: Ride | Ride[] | null | undefined) {
  if (Array.isArray(live)) return live;
  if (!live) return [];
  return [live];
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

export function getLiveDriverRequests(live: Ride | Ride[] | null | undefined) {
  return normalizeDriverRequests(live);
}

export function getProjectedDriverRequests(snapshot: RideShadowSnapshot | null | undefined) {
  return [...(snapshot?.shadowDriverRequests ?? [])];
}

export function getReadModelSource(options: { projectedAvailable?: boolean } = {}): RideReadModelSource {
  if (liveReadModelForced) return 'live';
  if (!ENABLE_RIDE_DUAL_READ) return 'live';
  if (!USE_PROJECTED_RIDE_READ_MODEL) return 'live';
  return options.projectedAvailable ? 'projected' : 'live';
}

export function forceLiveRideReadModel() {
  liveReadModelForced = true;
  return 'live' as const;
}

export function assertProjectedReadDisabledInProduction() {
  if (process.env.NODE_ENV === 'production' && USE_PROJECTED_RIDE_READ_MODEL) {
    throw new Error('Projected ride read models must remain disabled in production.');
  }
  return true;
}

export function createRideDualReadSnapshot(
  live: RideDualReadLiveSnapshot,
  shadowSnapshot: RideShadowSnapshot | null | undefined,
): RideDualReadSnapshot {
  const projectedAvailable = Boolean(shadowSnapshot?.enabled && shadowSnapshot?.running);
  const projected: RideDualReadProjectedSnapshot | null = projectedAvailable
    ? {
        activeRide: getProjectedActiveRide(shadowSnapshot),
        rideHistory: getProjectedRideHistory(shadowSnapshot),
        driverRequests: getProjectedDriverRequests(shadowSnapshot),
      }
    : null;

  return {
    enabled: ENABLE_RIDE_DUAL_READ,
    source: getReadModelSource({ projectedAvailable }),
    projectedAvailable,
    live: {
      activeRide: getLiveActiveRide(live.activeRide),
      rideHistory: getLiveRideHistory(live.rideHistory),
      driverRequests: getLiveDriverRequests(live.driverRequests),
    },
    projected,
    comparison: ENABLE_RIDE_DUAL_READ && projectedAvailable
      ? compareRideDualReadModels(live, projected)
      : null,
  };
}

export function useRideReadModel(): RideDualReadSnapshot {
  const ride = useRide();
  const shadowSnapshot = rideShadowProjectionManager.getSnapshot();

  const snapshot = useMemo(() => createRideDualReadSnapshot({
    activeRide: ride.currentRide,
    rideHistory: ride.rideHistory,
    driverRequests: ride.pendingRequest ? [ride.pendingRequest] : [],
  }, shadowSnapshot), [ride.currentRide, ride.rideHistory, ride.pendingRequest, shadowSnapshot]);

  useEffect(() => {
    if (!ENABLE_RIDE_DUAL_READ) return;
    recordRideDualReadTelemetry(snapshot);
  }, [snapshot]);

  return snapshot;
}

export function useActiveRideReadModel(): RideDualReadSlice<Ride | null, ActiveRideReadModel | null> {
  const snapshot = useRideReadModel();
  return {
    enabled: snapshot.enabled,
    source: snapshot.source,
    projectedAvailable: snapshot.projectedAvailable,
    live: snapshot.live.activeRide,
    projected: snapshot.projected?.activeRide ?? null,
    comparison: snapshot.comparison,
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
