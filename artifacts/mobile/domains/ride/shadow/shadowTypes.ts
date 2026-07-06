import type { DomainEvent } from '@/events';
import type { Ride } from '@/types';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import type { RideLifecycleEvent } from '../events';

export const ENABLE_SHADOW_RIDE_PROJECTION = process.env.NODE_ENV !== 'production';

export interface RideShadowReadModels {
  shadowActiveRide: ActiveRideReadModel | null;
  shadowRideHistory: RideHistoryReadModel[];
  shadowDriverRequests: DriverRideRequestReadModel[];
}

export interface RideProviderSnapshot {
  activeRide: Ride | null;
  rideHistory: Ride[];
  driverRequests?: Ride[];
}

export interface ShadowFieldDiff {
  field: string;
  production: unknown;
  shadow: unknown;
}

export interface RideProjectionMismatch {
  name: 'RideProjectionMismatch';
  aggregateId: string;
  eventId: string | null;
  eventType: string | null;
  correlationId: string | null;
  sequenceNumber: number | null;
  fieldDiff: ShadowFieldDiff[];
}

export interface RideShadowComparisonResult {
  activeRideDiff: ShadowFieldDiff[];
  historyDiff: ShadowFieldDiff[];
  driverRequestDiff: ShadowFieldDiff[];
  mismatch: RideProjectionMismatch | null;
}

export interface RideShadowSnapshot extends RideShadowReadModels {
  enabled: boolean;
  running: boolean;
  projectionStatus: 'idle' | 'running' | 'replaying' | 'stopped';
  lastProcessedEvent: RideLifecycleEvent | null;
  comparisonCount: number;
  mismatchCount: number;
  lastComparison: RideShadowComparisonResult | null;
}

export interface RideShadowTelemetry {
  recordMismatch(mismatch: RideProjectionMismatch): void;
  recordProjection(event: DomainEvent): void;
  recordReplay(count: number): void;
}
