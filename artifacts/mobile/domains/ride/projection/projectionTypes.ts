import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import type { Ride } from '@/types';
import type { RideDualReadComparison, RideReadModelSource } from '../dualRead/rideDualReadTypes';
import type { RideProjectionSelectionResult } from './projectionSelection';

export const ENABLE_RIDE_PROJECTION_COORDINATION = process.env.NODE_ENV !== 'production';
export const ENABLE_PROJECTED_HISTORY_CANARY = process.env.ENABLE_PROJECTED_HISTORY_CANARY === 'true';
export const ENABLE_PROJECTED_RIDE_DETAIL_CANARY = process.env.ENABLE_PROJECTED_RIDE_DETAIL_CANARY === 'true';

export type RideProjectionSelectionKind = 'LIVE' | 'PROJECTED' | 'SHADOW_ONLY' | 'UNAVAILABLE';

export interface RideProjectionFeatureFlags {
  enableProjectionCoordination: boolean;
  enableDualRead: boolean;
  useProjectedRideReadModel: boolean;
  enableProjectedHistoryCanary: boolean;
  enableProjectedRideDetailCanary: boolean;
}

export interface RideProjectionLiveSnapshot {
  activeRide: Ride | null;
  rideHistory: Ride[];
  driverRequests: Ride[];
}

export interface RideProjectionProjectedSnapshot {
  activeRide: ActiveRideReadModel | null;
  rideHistory: RideHistoryReadModel[];
  driverRequests: DriverRideRequestReadModel[];
}

export interface RideProjectionDiagnostics {
  comparisonCount: number;
  mismatchCount: number;
  lastMismatch: RideDualReadComparison['mismatch'];
  lastProjection: RideProjectionSelectionResult | null;
  currentSource: RideProjectionSelectionKind;
}

export interface RideProjectionSnapshot extends RideProjectionDiagnostics {
  enabled: boolean;
  flags: RideProjectionFeatureFlags;
  source: RideReadModelSource;
  selection: RideProjectionSelectionResult;
  projectedAvailable: boolean;
  live: RideProjectionLiveSnapshot;
  projected: RideProjectionProjectedSnapshot | null;
  comparison: RideDualReadComparison | null;
  fallbackToLive: boolean;
}

export interface RideProjectionLiveOrProjected<TLive, TProjected> {
  live: TLive;
  projected: TProjected | null;
}
