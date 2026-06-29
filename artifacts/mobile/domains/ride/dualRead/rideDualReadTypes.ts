import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import type { Ride } from '@/types';
import type { ShadowFieldDiff, RideProjectionMismatch } from '../shadow/shadowTypes';

export const ENABLE_RIDE_DUAL_READ = process.env.NODE_ENV !== 'production';
export const USE_PROJECTED_RIDE_READ_MODEL = false;

export type RideReadModelSource = 'live' | 'projected';

export interface RideDualReadComparison {
  activeRideDiff: ShadowFieldDiff[];
  historyDiff: ShadowFieldDiff[];
  driverRequestDiff: ShadowFieldDiff[];
  mismatch: RideProjectionMismatch | null;
}

export interface RideDualReadLiveSnapshot {
  activeRide: Ride | null;
  rideHistory: Ride[];
  driverRequests: Ride[];
}

export interface RideDualReadProjectedSnapshot {
  activeRide: ActiveRideReadModel | null;
  rideHistory: RideHistoryReadModel[];
  driverRequests: DriverRideRequestReadModel[];
}

export interface RideDualReadSnapshot {
  enabled: boolean;
  source: RideReadModelSource;
  projectedAvailable: boolean;
  live: RideDualReadLiveSnapshot;
  projected: RideDualReadProjectedSnapshot | null;
  comparison: RideDualReadComparison | null;
}

export interface RideDualReadSlice<TLive, TProjected> {
  enabled: boolean;
  source: RideReadModelSource;
  projectedAvailable: boolean;
  live: TLive;
  projected: TProjected | null;
  comparison: RideDualReadComparison | null;
}

export function createRideDualReadComparison(
  activeRideDiff: ShadowFieldDiff[],
  historyDiff: ShadowFieldDiff[],
  driverRequestDiff: ShadowFieldDiff[],
): RideDualReadComparison {
  const fieldDiff = [...activeRideDiff, ...historyDiff, ...driverRequestDiff];
  const mismatch: RideProjectionMismatch | null = fieldDiff.length > 0
    ? {
        name: 'RideProjectionMismatch',
        aggregateId: 'ride-dual-read',
        eventId: null,
        eventType: 'ride.dual_read.comparison',
        correlationId: null,
        sequenceNumber: null,
        fieldDiff,
      }
    : null;

  return {
    activeRideDiff,
    historyDiff,
    driverRequestDiff,
    mismatch,
  };
}

