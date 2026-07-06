import type { Ride } from '@/types';

export type RideCanaryName = 'history' | 'detail';

export type RideCanaryStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

export interface RideCanaryParityDiff {
  field: string;
  live: unknown;
  projected: unknown;
}

export interface RideCanaryParityAnalysis {
  canaryName: RideCanaryName;
  matched: boolean;
  fieldDiff: RideCanaryParityDiff[];
  comparisonTimestamp: string;
}

export interface RideCanaryMismatchRecord extends RideCanaryParityAnalysis {
  mismatchCount: number;
}

export interface RideCanaryFallbackRecord {
  canaryName: RideCanaryName;
  reason: string;
  fallbackTimestamp: string;
}

export interface RideCanaryHealthCounters {
  comparisons: number;
  matches: number;
  mismatches: number;
  liveFallbacks: number;
  projectionUnavailable: number;
  mappingFailures: number;
}

export interface RideCanaryHealthState extends RideCanaryHealthCounters {
  lastMismatch: RideCanaryMismatchRecord | null;
  lastFallback: RideCanaryFallbackRecord | null;
  lastComparisonTimestamp: string | null;
}

export interface RideCanaryHealthThresholds {
  maxMismatchRate: number;
  maxFallbackRate: number;
  minProjectedAvailabilityRate: number;
  maxMappingFailureRate: number;
}

export const DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS: RideCanaryHealthThresholds = {
  maxMismatchRate: 0.01,
  maxFallbackRate: 0.05,
  minProjectedAvailabilityRate: 0.95,
  maxMappingFailureRate: 0,
};

export interface RideCanaryHealthReportEntry {
  canaryName: RideCanaryName;
  currentStatus: RideCanaryStatus;
  comparisonCount: number;
  successRate: number;
  mismatchRate: number;
  fallbackCount: number;
  mappingFailures: number;
  projectionUnavailableCount: number;
  projectedAvailabilityRate: number;
  lastMismatch: RideCanaryMismatchRecord | null;
  lastFallback: RideCanaryFallbackRecord | null;
  lastComparisonTimestamp: string | null;
}

export interface RideCanaryHealthReport {
  generatedAt: string;
  thresholds: RideCanaryHealthThresholds;
  canaries: Record<RideCanaryName, RideCanaryHealthReportEntry>;
  activeRideCanaryReady: boolean;
  summary: {
    totalComparisons: number;
    totalMatches: number;
    totalMismatches: number;
    totalFallbacks: number;
    totalMappingFailures: number;
  };
}

export interface RideCanaryHealthSnapshot {
  history: RideCanaryHealthState;
  detail: RideCanaryHealthState;
}

export interface RideCanarySemanticFields {
  rideId: string;
  status: Ride['status'];
  customerId: string;
  customerName: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleType: Ride['vehicleType'];
  requestedVehicleType: Ride['requestedVehicleType'] | null;
  matchedVehicleType: Ride['matchedVehicleType'] | null;
  matchedVehicleId: Ride['matchedVehicleId'] | null;
  pickup: {
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };
  distance: number;
  duration: number;
  suggestedFare: number;
  agreedFare: number | null;
  createdAt: string;
  completedAt: string | null;
  arrivedAt: string | null;
  waitStartedAt: string | null;
}
