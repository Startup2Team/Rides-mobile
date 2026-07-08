import type { Ride } from '@/types';
import type { DriverStatisticsBucket, DriverStatisticsPeriodWindow } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function positiveFare(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function isCompletedDriverRideForStatistics(ride: Ride, driverId?: string | null) {
  return Boolean(
    driverId
    && ride.driverId === driverId
    && ride.status === 'completed'
    && ride.completedAt,
  );
}

function getBucketLabel(start: Date, granularity: DriverStatisticsPeriodWindow['bucketGranularity']) {
  if (granularity === 'hour') {
    return start.getHours().toString().padStart(2, '0');
  }
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(start);
}

export function createDriverStatisticsBuckets(window: DriverStatisticsPeriodWindow): DriverStatisticsBucket[] {
  const startTime = new Date(window.startAt).getTime();
  const endTime = new Date(window.endAt).getTime();
  const step = window.bucketGranularity === 'hour' ? HOUR_MS : DAY_MS;
  const buckets: DriverStatisticsBucket[] = [];

  for (let cursor = startTime; cursor <= endTime; cursor += step) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(Math.min(cursor + step - 1, endTime));
    buckets.push({
      id: `${window.period}:${bucketStart.toISOString()}`,
      label: getBucketLabel(bucketStart, window.bucketGranularity),
      startAt: bucketStart.toISOString(),
      endAt: bucketEnd.toISOString(),
      completedTrips: 0,
      earningsRwf: 0,
    });
  }

  return buckets;
}

export function summarizeCompletedRide(ride: Ride) {
  return {
    completedTrips: 1,
    earningsRwf: positiveFare(ride.agreedFare),
  };
}

export function buildDriverStatisticsBuckets({
  driverId,
  rideHistory,
  window,
}: {
  driverId?: string | null;
  rideHistory: Ride[];
  window: DriverStatisticsPeriodWindow;
}) {
  const buckets = createDriverStatisticsBuckets(window);

  rideHistory
    .filter(ride => isCompletedDriverRideForStatistics(ride, driverId))
    .forEach(ride => {
      const completedAt = new Date(ride.completedAt as string).getTime();
      if (Number.isNaN(completedAt)) return;
      const bucket = buckets.find(item =>
        completedAt >= new Date(item.startAt).getTime()
        && completedAt <= new Date(item.endAt).getTime()
      );
      if (!bucket) return;
      const summary = summarizeCompletedRide(ride);
      bucket.completedTrips += summary.completedTrips;
      bucket.earningsRwf += summary.earningsRwf;
    });

  return buckets;
}
