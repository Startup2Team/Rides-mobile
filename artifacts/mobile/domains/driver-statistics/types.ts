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

export interface DriverStatisticsInput {
  currentDriverId?: string | null;
  rideHistory: Ride[];
  driverProfile?: DriverProfile | null;
  driverRatingSummary: DriverRatingSummary;
  driverEntitlement?: DriverEntitlement | null;
  selectedPeriod: DriverStatisticsPeriod;
  now: Date;
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
