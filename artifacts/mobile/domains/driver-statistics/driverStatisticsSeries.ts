import type { DriverStatisticsBucket, DriverStatisticsPeriodWindow } from './types';

export interface DriverStatisticsSeriesPoint {
  id: string;
  label: string;
  value: number;
  available: boolean;
}

export interface DriverStatisticsSparseLabel {
  index: number;
  label: string;
}

export function getCompletedTripsSeries(buckets: DriverStatisticsBucket[]): DriverStatisticsSeriesPoint[] {
  return buckets.map(bucket => ({
    id: bucket.id,
    label: bucket.label,
    value: bucket.completedTrips,
    available: true,
  }));
}

export function getEarningsPerTripSeries(buckets: DriverStatisticsBucket[]): DriverStatisticsSeriesPoint[] {
  return buckets.map(bucket => ({
    id: bucket.id,
    label: bucket.label,
    value: bucket.completedTrips > 0 ? bucket.earningsRwf / bucket.completedTrips : 0,
    available: bucket.completedTrips > 0,
  }));
}

export function getDriverStatisticsSparseLabels(window: DriverStatisticsPeriodWindow, buckets: DriverStatisticsBucket[]): DriverStatisticsSparseLabel[] {
  if (window.period === 'today') {
    return [0, 6, 12, 18]
      .filter(index => index < buckets.length)
      .map(index => ({ index, label: buckets[index].label }));
  }

  if (window.period === 'week') {
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      .slice(0, buckets.length)
      .map((label, index) => ({ index, label }));
  }

  if (buckets.length === 0) return [];
  const lastIndex = buckets.length - 1;
  const midIndex = Math.floor(lastIndex / 2);
  return [0, midIndex, lastIndex]
    .filter((index, arrayIndex, indexes) => indexes.indexOf(index) === arrayIndex)
    .map(index => ({ index, label: String(new Date(buckets[index].startAt).getDate()) }));
}

export function formatDriverStatisticsBucketLabel(bucket: DriverStatisticsBucket, window: DriverStatisticsPeriodWindow) {
  const start = new Date(bucket.startAt);
  const end = new Date(bucket.endAt);

  if (window.period === 'today') {
    const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
    return `${formatter.format(start)}-${formatter.format(end)}`;
  }

  if (window.period === 'week') {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(start);
  }

  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(start);
}
