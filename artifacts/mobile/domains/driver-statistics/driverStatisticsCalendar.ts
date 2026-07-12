import {
  isValidLocalDateString,
  toLocalDateString,
  type DriverDailyGoalRecord,
  resolveConfiguredDailyGoalForDate,
  progressRatioForConfiguredGoal,
} from './driverDailyGoals';
import {
  isFutureLocalDateString,
  localDateStringToLocalDate,
} from './driverLocalDates';
import type { DriverDailyStatistics } from './driverDailyStatistics';
import { createEmptyDriverDailyStatistics } from './driverDailyStatistics';

/** Fixed earliest calendar year — January of this year through the current month. */
export const MIN_CALENDAR_YEAR = 1500;

export const DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS = [
  'M',
  'T',
  'W',
  'T',
  'F',
  'S',
  'S',
] as const;

export type CalendarDayCell =
  | {
      kind: 'empty';
      key: string;
    }
  | {
      kind: 'date';
      localDate: string;
      dayNumber: number;
      isToday: boolean;
      isSelected: boolean;
      isFuture: boolean;
      goalState: 'configured' | 'unconfigured';
      progress: number;
      earningsRwf: number;
      goalRwf: number | null;
    };

export type DriverStatisticsCalendarMonth = {
  monthKey: string;
  year: number;
  monthIndex: number;
  label: string;
  weeks: Array<Array<CalendarDayCell>>;
};

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const monthShortLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
});

export function formatCalendarMonthLabel(year: number, monthIndex: number) {
  return monthLabelFormatter.format(new Date(year, monthIndex, 1));
}

export function formatCalendarMonthShortLabel(year: number, monthIndex: number) {
  // en-US short month includes a trailing period in some engines ("Jan."); strip it.
  return monthShortLabelFormatter
    .format(new Date(year, monthIndex, 1))
    .replace(/\.$/, '');
}

export function getCalendarMonthLabelForIndex(
  index: number,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  const { year, monthIndex } = getCalendarMonthFromIndex(index, minYear);
  return formatCalendarMonthLabel(year, monthIndex);
}

function padMonthPart(value: number) {
  return String(value).padStart(2, '0');
}

export function toMonthKey(year: number, monthIndex: number) {
  return `${year}-${padMonthPart(monthIndex + 1)}`;
}

export function monthKeyFromLocalDate(localDate: string) {
  if (!isValidLocalDateString(localDate)) return null;
  return localDate.slice(0, 7);
}

export function startOfMonthLocalDate(localDate: string) {
  const date = localDateStringToLocalDate(localDate);
  if (!date) return localDate;
  return toLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function addLocalMonths(localDate: string, months: number) {
  const date = localDateStringToLocalDate(localDate);
  if (!date || !Number.isInteger(months)) return localDate;
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return toLocalDateString(next);
}

export function getCalendarMonthFromIndex(
  index: number,
  minYear: number = MIN_CALENDAR_YEAR,
): { year: number; monthIndex: number } {
  const safeIndex = Math.max(0, Math.floor(index));
  return {
    year: minYear + Math.floor(safeIndex / 12),
    monthIndex: safeIndex % 12,
  };
}

export function getCalendarIndexForMonth(
  year: number,
  monthIndex: number,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  return (year - minYear) * 12 + monthIndex;
}

export function getCalendarTotalMonths(
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  const today = localDateStringToLocalDate(todayLocalDate);
  if (!today) return 1;
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  if (currentYear < minYear) return 1;
  return (currentYear - minYear) * 12 + currentMonthIndex + 1;
}

export function getCalendarIndexForLocalDate(
  localDate: string,
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  const total = getCalendarTotalMonths(todayLocalDate, minYear);
  const date = localDateStringToLocalDate(localDate);
  if (!date) return Math.max(0, total - 1);

  const index = getCalendarIndexForMonth(date.getFullYear(), date.getMonth(), minYear);
  if (index < 0) return 0;
  if (index >= total) return Math.max(0, total - 1);
  return index;
}

export function createCalendarMonthIndexData(
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
): number[] {
  const total = getCalendarTotalMonths(todayLocalDate, minYear);
  const indexes = new Array<number>(total);
  for (let i = 0; i < total; i += 1) {
    indexes[i] = i;
  }
  return indexes;
}

function buildMonthWeeks({
  year,
  monthIndex,
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
}: {
  year: number;
  monthIndex: number;
  todayLocalDate: string;
  selectedLocalDate: string;
  dailyStatisticsIndex: Map<string, DriverDailyStatistics>;
  goalRecords: DriverDailyGoalRecord[];
}): Array<Array<CalendarDayCell>> {
  const firstDay = new Date(year, monthIndex, 1);
  const firstDayIndex = firstDay.getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-lead-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const localDate = toLocalDateString(new Date(year, monthIndex, day));
    const stats =
      dailyStatisticsIndex.get(localDate) ?? createEmptyDriverDailyStatistics(localDate);
    const resolved = resolveConfiguredDailyGoalForDate({
      records: goalRecords,
      selectedLocalDate: localDate,
    });
    const isFuture = isFutureLocalDateString(localDate, todayLocalDate);
    const goalConfigured = resolved.status === 'configured';
    const progress = isFuture
      ? 0
      : progressRatioForConfiguredGoal({
          earningsRwf: stats.earningsRwf,
          resolved,
        });

    cells.push({
      kind: 'date',
      localDate,
      dayNumber: day,
      isToday: localDate === todayLocalDate,
      isSelected: localDate === selectedLocalDate,
      isFuture,
      goalState: goalConfigured ? 'configured' : 'unconfigured',
      progress,
      earningsRwf: stats.earningsRwf,
      goalRwf: goalConfigured ? resolved.amountRwf : null,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      kind: 'empty',
      key: `empty-${year}-${monthIndex}-trail-${cells.length}`,
    });
  }

  const weeks: Array<Array<CalendarDayCell>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/**
 * Lazily builds a single month grid from a FlatList index.
 * Does not precompute neighboring months.
 */
export function buildDriverStatisticsCalendarMonthAtIndex({
  index,
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
  minYear = MIN_CALENDAR_YEAR,
}: {
  index: number;
  todayLocalDate: string;
  selectedLocalDate: string;
  dailyStatisticsIndex: Map<string, DriverDailyStatistics>;
  goalRecords: DriverDailyGoalRecord[];
  minYear?: number;
}): DriverStatisticsCalendarMonth {
  const total = getCalendarTotalMonths(todayLocalDate, minYear);
  const clampedIndex = Math.min(Math.max(0, index), Math.max(0, total - 1));
  const { year, monthIndex } = getCalendarMonthFromIndex(clampedIndex, minYear);

  return {
    monthKey: toMonthKey(year, monthIndex),
    year,
    monthIndex,
    label: formatCalendarMonthLabel(year, monthIndex),
    weeks: buildMonthWeeks({
      year,
      monthIndex,
      todayLocalDate,
      selectedLocalDate,
      dailyStatisticsIndex,
      goalRecords,
    }),
  };
}

export function clampCalendarJumpYear(
  year: number,
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  const today = localDateStringToLocalDate(todayLocalDate);
  const maxYear = today?.getFullYear() ?? new Date().getFullYear();
  if (!Number.isFinite(year)) return maxYear;
  return Math.min(maxYear, Math.max(minYear, Math.floor(year)));
}

export type ParseCalendarJumpYearResult =
  | { ok: true; year: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-low' | 'too-high' };

export function parseCalendarJumpYear(
  input: string,
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
): ParseCalendarJumpYearResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: 'invalid' };

  const year = Number(trimmed);
  if (!Number.isInteger(year)) return { ok: false, reason: 'invalid' };

  const today = localDateStringToLocalDate(todayLocalDate);
  const maxYear = today?.getFullYear() ?? new Date().getFullYear();
  if (year < minYear) return { ok: false, reason: 'too-low' };
  if (year > maxYear) return { ok: false, reason: 'too-high' };
  return { ok: true, year };
}

export function getCalendarIndexForJumpYear(
  year: number,
  todayLocalDate: string,
  minYear: number = MIN_CALENDAR_YEAR,
) {
  const clampedYear = clampCalendarJumpYear(year, todayLocalDate, minYear);
  const today = localDateStringToLocalDate(todayLocalDate);
  const currentYear = today?.getFullYear() ?? clampedYear;
  const currentMonthIndex = today?.getMonth() ?? 0;
  const monthIndex = clampedYear === currentYear ? currentMonthIndex : 0;
  return getCalendarIndexForLocalDate(
    toLocalDateString(new Date(clampedYear, monthIndex, 1)),
    todayLocalDate,
    minYear,
  );
}

/** Approximate height for full-page month rows (up to 6 week rows). */
export const DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT = 290;
