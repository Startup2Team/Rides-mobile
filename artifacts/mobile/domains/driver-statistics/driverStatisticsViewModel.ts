import {
  getActiveBonusRides,
  getRideBalance,
  type DriverPackagePurchase,
} from '@/domain/driverRidePackages';
import { getDriverStatisticsPeriodWindow } from './driverStatisticsPeriods';
import { buildDriverStatisticsBuckets } from './driverStatisticsBuckets';
import { getDriverStatisticsInsights } from './driverStatisticsInsights';
import type {
  DriverStatisticsInput,
  DriverStatisticsMetric,
  DriverStatisticsSourceMetadata,
  DriverStatisticsViewModel,
} from './types';

const PRIORITY_DECLINE_THRESHOLD = 10;

const localRideHistorySource: DriverStatisticsSourceMetadata = {
  source: 'local_ride_history',
  confidence: 'medium',
  note: 'Derived from local completed ride history. Not backend-authoritative.',
};

const localProfileSource: DriverStatisticsSourceMetadata = {
  source: 'local_profile',
  confidence: 'medium',
  note: 'Read from the local driver profile.',
};

const localProfileLowSource: DriverStatisticsSourceMetadata = {
  source: 'local_profile',
  confidence: 'low',
  note: 'Local profile value can be stale until backend statistics exist.',
};

const localRatingsSource: DriverStatisticsSourceMetadata = {
  source: 'local_ratings',
  confidence: 'medium',
  note: 'Derived from locally stored driver ratings.',
};

const localEntitlementSource: DriverStatisticsSourceMetadata = {
  source: 'local_entitlement',
  confidence: 'medium',
  note: 'Derived from local package entitlement state.',
};

const derivedSource: DriverStatisticsSourceMetadata = {
  source: 'derived',
  confidence: 'medium',
};

function metric<TValue>(value: TValue, source: DriverStatisticsSourceMetadata): DriverStatisticsMetric<TValue> {
  return { value, source };
}

function safeProfileNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isMeaningfulPurchaseHistory(purchases: DriverPackagePurchase[]) {
  return purchases.some(purchase => purchase.status === 'successful' || purchase.status === 'processing' || purchase.status === 'pending');
}

export function createDriverStatisticsViewModel(input: DriverStatisticsInput): DriverStatisticsViewModel {
  const period = getDriverStatisticsPeriodWindow(input.selectedPeriod, input.now);
  const buckets = buildDriverStatisticsBuckets({
    driverId: input.currentDriverId,
    rideHistory: input.rideHistory,
    window: period,
  });
  const completedTrips = buckets.reduce((sum, bucket) => sum + bucket.completedTrips, 0);
  const periodEarningsRwf = buckets.reduce((sum, bucket) => sum + bucket.earningsRwf, 0);
  const earningsPerTripRwf = completedTrips > 0 ? periodEarningsRwf / completedTrips : null;
  const allTimeCompletedTrips = safeProfileNumber(input.driverProfile?.completedRides);
  const allTimeRideRevenueRwf = safeProfileNumber(input.driverProfile?.earningsTotal);
  const dailyDeclines = safeProfileNumber(input.driverProfile?.dailyDeclines);
  const dailyRides = safeProfileNumber(input.driverProfile?.dailyRides);
  const acceptanceDecisionCount = dailyRides + dailyDeclines;
  const acceptanceRate = acceptanceDecisionCount > 0 ? safeProfileNumber(input.driverProfile?.acceptanceRate) : null;
  const remainingRideCredits = getRideBalance(input.driverEntitlement);
  const remainingBonusRides = getActiveBonusRides(input.driverEntitlement);
  const purchases = input.driverEntitlement?.purchaseHistory ?? [];
  const isNewDriverStatsState =
    allTimeCompletedTrips === 0
    && completedTrips === 0
    && input.driverRatingSummary.ratingCount === 0
    && !isMeaningfulPurchaseHistory(purchases);

  return {
    period,
    buckets,
    insights: getDriverStatisticsInsights({ buckets, completedTrips, earningsPerTripRwf, period }),
    metrics: {
      periodEarningsRwf: metric(periodEarningsRwf, localRideHistorySource),
      completedTrips: metric(completedTrips, localRideHistorySource),
      earningsPerTripRwf: metric(earningsPerTripRwf, earningsPerTripRwf === null ? { source: 'unavailable', confidence: 'high' } : derivedSource),
      allTimeCompletedTrips: metric(allTimeCompletedTrips, localProfileSource),
      allTimeRideRevenueRwf: metric(allTimeRideRevenueRwf, localProfileLowSource),
      driverRating: metric(input.driverRatingSummary, localRatingsSource),
      acceptanceRate: metric(acceptanceRate, localProfileLowSource),
      dailyDeclines: metric(dailyDeclines, localProfileLowSource),
      priorityRisk: metric({
        isReduced: dailyDeclines >= PRIORITY_DECLINE_THRESHOLD,
        threshold: PRIORITY_DECLINE_THRESHOLD,
        declinesUntilReduced: Math.max(0, PRIORITY_DECLINE_THRESHOLD - dailyDeclines),
      }, {
        source: 'derived',
        confidence: 'low',
        note: 'Uses the current local decline-priority policy threshold.',
      }),
      rideBalance: metric({
        remainingRideCredits,
        remainingBonusRides,
        totalAvailableRides: remainingRideCredits + remainingBonusRides,
      }, localEntitlementSource),
      packagePurchaseHistory: metric(purchases, {
        ...localEntitlementSource,
        note: 'Supporting package data only; not primary driver analytics.',
      }),
    },
    isNewDriverStatsState,
    emptyStateTitle: 'Start driving to build your statistics.',
    emptyStateDescription: 'Your earnings, trips, and trends will appear here after completed rides.',
  };
}
