import { formatDriverStatisticsRwf } from './driverStatisticsFormatting';
import { formatDriverStatisticsBucketLabel } from './driverStatisticsSeries';
import type { DriverStatisticsBucket, DriverStatisticsInsight } from './types';

const derivedMedium = {
  confidence: 'medium',
  source: 'derived',
} as const;

export function getDriverStatisticsInsights({
  buckets,
  completedTrips,
  earningsPerTripRwf,
  period,
}: {
  buckets: DriverStatisticsBucket[];
  completedTrips: number;
  earningsPerTripRwf: number | null;
  period?: Parameters<typeof formatDriverStatisticsBucketLabel>[1];
}): DriverStatisticsInsight[] {
  if (completedTrips <= 0) {
    return [{
      id: 'no-completed-trips',
      message: 'Complete trips to unlock your statistics.',
      source: derivedMedium,
    }];
  }

  const insights: DriverStatisticsInsight[] = [{
    id: 'completed-trips',
    message: `You completed ${completedTrips} ${completedTrips === 1 ? 'trip' : 'trips'} in this period.`,
    source: derivedMedium,
  }];

  if (earningsPerTripRwf !== null) {
    insights.push({
      id: 'earnings-per-trip',
      message: `Average earning per trip is ${formatDriverStatisticsRwf(earningsPerTripRwf)}.`,
      source: derivedMedium,
    });
  }

  const bestBucket = buckets
    .filter(bucket => bucket.earningsRwf > 0)
    .sort((a, b) => b.earningsRwf - a.earningsRwf)[0];

  if (bestBucket) {
    insights.push({
      id: 'best-earning-bucket',
      message: `Your strongest earning period was ${period ? formatDriverStatisticsBucketLabel(bestBucket, period) : bestBucket.label}.`,
      source: derivedMedium,
    });
  }

  return insights;
}
