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

const backendSource: DriverStatisticsSourceMetadata = {
  source: 'backend',
  confidence: 'high',
  note: 'Backend-authoritative driver statistics.',
};

const unavailableSource: DriverStatisticsSourceMetadata = {
  source: 'unavailable',
  confidence: 'high',
  note: 'No backend endpoint yet — value is unavailable.',
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

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
  const backend = input.backend;
  const backendPeriodEarnings = finiteOrNull(backend?.periodEarningsRwf);
  const backendPeriodTrips = finiteOrNull(backend?.periodCompletedTrips);
  const backendAllTimeTrips = finiteOrNull(backend?.allTimeCompletedTrips);
  const backendAcceptanceRate = finiteOrNull(backend?.acceptanceRate);
  const backendCompletionRate = finiteOrNull(backend?.completionRate);
  const backendPriorityTier = finiteOrNull(backend?.priorityTier);

  const localCompletedTrips = buckets.reduce((sum, bucket) => sum + bucket.completedTrips, 0);
  const localPeriodEarningsRwf = buckets.reduce((sum, bucket) => sum + bucket.earningsRwf, 0);
  // Prefer backend period figures when available; fall back to locally derived.
  const completedTrips = backendPeriodTrips ?? localCompletedTrips;
  const periodEarningsRwf = backendPeriodEarnings ?? localPeriodEarningsRwf;
  const periodEarningsSource = backendPeriodEarnings !== null ? backendSource : localRideHistorySource;
  const completedTripsSource = backendPeriodTrips !== null ? backendSource : localRideHistorySource;
  const earningsPerTripRwf = completedTrips > 0 ? periodEarningsRwf / completedTrips : null;
  const allTimeCompletedTrips = backendAllTimeTrips ?? safeProfileNumber(input.driverProfile?.completedRides);
  const allTimeCompletedTripsSource = backendAllTimeTrips !== null ? backendSource : localProfileSource;
  const allTimeRideRevenueRwf = safeProfileNumber(input.driverProfile?.earningsTotal);
  const dailyDeclines = safeProfileNumber(input.driverProfile?.dailyDeclines);
  const dailyRides = safeProfileNumber(input.driverProfile?.dailyRides);
  const acceptanceDecisionCount = dailyRides + dailyDeclines;
  const localAcceptanceRate = acceptanceDecisionCount > 0 ? safeProfileNumber(input.driverProfile?.acceptanceRate) : null;
  const acceptanceRate = backendAcceptanceRate ?? localAcceptanceRate;
  const acceptanceRateSource = backendAcceptanceRate !== null ? backendSource : localProfileLowSource;
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
      periodEarningsRwf: metric(periodEarningsRwf, periodEarningsSource),
      completedTrips: metric(completedTrips, completedTripsSource),
      earningsPerTripRwf: metric(earningsPerTripRwf, earningsPerTripRwf === null ? { source: 'unavailable', confidence: 'high' } : derivedSource),
      allTimeCompletedTrips: metric(allTimeCompletedTrips, allTimeCompletedTripsSource),
      allTimeRideRevenueRwf: metric(allTimeRideRevenueRwf, localProfileLowSource),
      driverRating: metric(input.driverRatingSummary, localRatingsSource),
      acceptanceRate: metric(acceptanceRate, acceptanceRateSource),
      completionRate: metric(backendCompletionRate, backendCompletionRate !== null ? backendSource : unavailableSource),
      priorityTier: metric(backendPriorityTier, backendPriorityTier !== null ? backendSource : unavailableSource),
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
