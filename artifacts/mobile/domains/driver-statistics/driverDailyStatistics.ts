import type { Ride } from '@/types';
import { isValidLocalDateString, toLocalDateString } from './driverDailyGoals';

export interface DriverDailyStatistics {
  localDate: string;
  earningsRwf: number;
  completedTrips: number;
  earningsPerTripRwf: number | null;
  hourlyEarningsRwf: number[];
  hourlyCompletedTrips: number[];
}

export interface CompletedDriverRideStatisticsRecord {
  completedAt: Date;
  earningsRwf: number;
  localDate: string;
}

function createEmptyHourlyBuckets() {
  return Array.from({ length: 24 }, () => 0);
}

export function createEmptyDriverDailyStatistics(localDate: string): DriverDailyStatistics {
  return {
    localDate,
    earningsRwf: 0,
    completedTrips: 0,
    earningsPerTripRwf: null,
    hourlyEarningsRwf: createEmptyHourlyBuckets(),
    hourlyCompletedTrips: createEmptyHourlyBuckets(),
  };
}

export function normalizeDriverStatisticsFare(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function getCompletedDriverRideStatisticsRecord(
  ride: Ride,
  driverId?: string | null,
): CompletedDriverRideStatisticsRecord | null {
  if (!driverId || ride.driverId !== driverId || ride.status !== 'completed' || !ride.completedAt) {
    return null;
  }

  const completedAt = new Date(ride.completedAt);
  if (Number.isNaN(completedAt.getTime())) return null;

  return {
    completedAt,
    earningsRwf: normalizeDriverStatisticsFare(ride.agreedFare),
    localDate: toLocalDateString(completedAt),
  };
}

export function buildDriverDailyStatisticsIndex({
  rides,
  driverId,
}: {
  rides: Ride[];
  driverId?: string | null;
}): Map<string, DriverDailyStatistics> {
  const mutableIndex = new Map<string, DriverDailyStatistics>();

  for (const ride of rides) {
    const record = getCompletedDriverRideStatisticsRecord(ride, driverId);
    if (!record) continue;

    const statistics = mutableIndex.get(record.localDate)
      ?? createEmptyDriverDailyStatistics(record.localDate);
    const hour = record.completedAt.getHours();

    statistics.completedTrips += 1;
    statistics.earningsRwf += record.earningsRwf;
    statistics.hourlyCompletedTrips[hour] += 1;
    statistics.hourlyEarningsRwf[hour] += record.earningsRwf;
    mutableIndex.set(record.localDate, statistics);
  }

  return new Map(
    Array.from(mutableIndex.entries())
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([localDate, statistics]) => [
        localDate,
        {
          ...statistics,
          earningsPerTripRwf: statistics.completedTrips > 0
            ? statistics.earningsRwf / statistics.completedTrips
            : null,
        },
      ]),
  );
}

export function getDriverDailyStatisticsForDate({
  rides,
  driverId,
  localDate,
}: {
  rides: Ride[];
  driverId?: string | null;
  localDate: string;
}): DriverDailyStatistics {
  if (!isValidLocalDateString(localDate)) {
    return createEmptyDriverDailyStatistics(localDate);
  }

  return buildDriverDailyStatisticsIndex({ rides, driverId }).get(localDate)
    ?? createEmptyDriverDailyStatistics(localDate);
}
