import type { DriverStatisticsPeriod, DriverStatisticsPeriodWindow } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function startOfLocalWeek(value: Date) {
  const start = startOfLocalDay(value);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(start.getTime() + mondayOffset * DAY_MS);
}

function endOfLocalWeek(value: Date) {
  const start = startOfLocalWeek(value);
  return new Date(start.getTime() + 7 * DAY_MS - 1);
}

function startOfLocalMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfLocalMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1, 0, 0, 0, -1);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(value);
}

export function getDriverStatisticsPeriodWindow(
  period: DriverStatisticsPeriod,
  now: Date,
): DriverStatisticsPeriodWindow {
  if (period === 'today') {
    const start = startOfLocalDay(now);
    const end = endOfLocalDay(now);
    return {
      period,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      label: 'Today',
      bucketGranularity: 'hour',
    };
  }

  if (period === 'week') {
    const start = startOfLocalWeek(now);
    const end = endOfLocalWeek(now);
    return {
      period,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      label: `${formatShortDate(start)} - ${formatShortDate(end)}`,
      bucketGranularity: 'day',
    };
  }

  const start = startOfLocalMonth(now);
  const end = endOfLocalMonth(now);
  return {
    period,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    label: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now),
    bucketGranularity: 'day',
  };
}

export function isInDriverStatisticsWindow(value: string | undefined, window: DriverStatisticsPeriodWindow) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= new Date(window.startAt).getTime() && time <= new Date(window.endAt).getTime();
}
