import type { DriverEntitlement, DriverPackagePurchase } from '@/domain/driverRidePackages';
import type { DriverRatingSummary } from '@/domain/driverWallet';
import type { DriverProfile, Ride } from '@/types';

export type DriverStatisticsPeriod = 'today' | 'week' | 'month';
export type DriverStatisticsBucketGranularity = 'hour' | 'day';
export type DriverStatisticsMetricSource =
  | 'local_ride_history'
  | 'local_profile'
  | 'local_ratings'
  | 'local_entitlement'
  | 'backend'
  | 'derived'
  | 'unavailable';
export type DriverStatisticsMetricConfidence = 'high' | 'medium' | 'low';

export interface DriverStatisticsSourceMetadata {
  source: DriverStatisticsMetricSource;
  confidence: DriverStatisticsMetricConfidence;
  note?: string;
}

export interface DriverStatisticsMetric<TValue> {
  value: TValue;
  source: DriverStatisticsSourceMetadata;
}

export interface DriverStatisticsPeriodWindow {
  period: DriverStatisticsPeriod;
  startAt: string;
  endAt: string;
  label: string;
  bucketGranularity: DriverStatisticsBucketGranularity;
}

export interface DriverStatisticsBucket {
  id: string;
  label: string;
  startAt: string;
  endAt: string;
  completedTrips: number;
  earningsRwf: number;
}

export interface DriverStatisticsInsight {
  id: string;
  message: string;
  source: DriverStatisticsSourceMetadata;
}

// Backend-authoritative values sourced from /driver/stats and
// /driver/earnings/*. When present they take precedence over the values derived
// from local ride history / profile. All fields are optional so callers (and
// tests) that only have local data continue to work unchanged.
export interface DriverStatisticsBackendInput {
  allTimeCompletedTrips?: number | null;
  acceptanceRate?: number | null;
  completionRate?: number | null;
  priorityTier?: number | null;
  // Earnings/trips for the currently selected period, when the backend exposes
  // them (today → /earnings/daily, week → /earnings/weekly).
  periodEarningsRwf?: number | null;
  periodCompletedTrips?: number | null;
}

export interface DriverStatisticsInput {
  currentDriverId?: string | null;
  rideHistory: Ride[];
  driverProfile?: DriverProfile | null;
  driverRatingSummary: DriverRatingSummary;
  driverEntitlement?: DriverEntitlement | null;
  selectedPeriod: DriverStatisticsPeriod;
  now: Date;
  backend?: DriverStatisticsBackendInput;
}

export interface DriverStatisticsViewModel {
  period: DriverStatisticsPeriodWindow;
  buckets: DriverStatisticsBucket[];
  insights: DriverStatisticsInsight[];
  metrics: {
    periodEarningsRwf: DriverStatisticsMetric<number>;
    completedTrips: DriverStatisticsMetric<number>;
    earningsPerTripRwf: DriverStatisticsMetric<number | null>;
    allTimeCompletedTrips: DriverStatisticsMetric<number>;
    allTimeRideRevenueRwf: DriverStatisticsMetric<number>;
    driverRating: DriverStatisticsMetric<DriverRatingSummary>;
    acceptanceRate: DriverStatisticsMetric<number | null>;
    completionRate: DriverStatisticsMetric<number | null>;
    priorityTier: DriverStatisticsMetric<number | null>;
    dailyDeclines: DriverStatisticsMetric<number>;
    priorityRisk: DriverStatisticsMetric<{
      isReduced: boolean;
      threshold: number;
      declinesUntilReduced: number;
    }>;
    rideBalance: DriverStatisticsMetric<{
      remainingRideCredits: number;
      remainingBonusRides: number;
      totalAvailableRides: number;
    }>;
    packagePurchaseHistory: DriverStatisticsMetric<DriverPackagePurchase[]>;
  };
  isNewDriverStatsState: boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
}
