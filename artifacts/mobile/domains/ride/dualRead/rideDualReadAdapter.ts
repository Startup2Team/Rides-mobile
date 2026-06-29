import React, { useMemo } from 'react';
import { useRide } from '@/context/RideContext';
import type { Ride } from '@/types';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import { rideShadowProjectionManager } from '../shadow/shadowProjectionManager';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';
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
