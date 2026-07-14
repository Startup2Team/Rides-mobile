import {
  isValidLocalDateString,
  toLocalDateString,
  type DriverDailyGoalRecord,
  resolveConfiguredDailyGoalForDate,
  progressRatioForConfiguredGoal,
} from './driverDailyGoals';
import {
  createLocalCalendarDate,
  isFutureLocalDateString,
  localDateStringToLocalDate,
} from './driverLocalDates';
import type { DriverDailyStatistics } from './driverDailyStatistics';
import { createEmptyDriverDailyStatistics } from './driverDailyStatistics';

export type RelativeMonthOffset = number;

export const CALENDAR_INITIAL_MONTH_BATCH = 240;
export const CALENDAR_PREPEND_MONTH_BATCH = 240;
export const CALENDAR_PREPEND_THRESHOLD = 12;

export const DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS = [
  'M', 'T', 'W', 'T', 'F', 'S', 'S',
] as const;

const CALENDAR_MONTH_VERTICAL_PADDING = 28;
const CALENDAR_WEEK_ROW_HEIGHT = 86;

export type CalendarDayCell =
  | { kind: 'empty'; key: string }
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
  relativeOffset: RelativeMonthOffset;
  year: number;
  monthIndex: number;
  label: string;
  weekCount: number;
  exactHeight: number;
  weeks: Array<Array<CalendarDayCell>>;
};

export type CalendarMonthLayout = {
  relativeOffset: RelativeMonthOffset;
  year: number;
  monthIndex: number;
  weekCount: number;
  length: number;
  offset: number;
  index: number;
};

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});
const monthShortLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

export function getYearMonthFromRelativeOffset({
  currentYear,
  currentMonthIndex,
  offset,
}: {
  currentYear: number;
  currentMonthIndex: number;
  offset: RelativeMonthOffset;
}) {
  if (!Number.isInteger(currentYear) || currentYear < 1) {
    throw new RangeError('Current calendar year must be a positive Common Era year.');
  }
  if (!Number.isInteger(currentMonthIndex) || currentMonthIndex < 0 || currentMonthIndex > 11) {
    throw new RangeError('Current calendar month index must be between 0 and 11.');
  }
  if (!Number.isInteger(offset) || offset > 0) {
    throw new RangeError('Relative calendar month offsets must be non-positive integers.');
  }
  const absoluteMonth = currentYear * 12 + currentMonthIndex + offset;
  return {
    year: Math.floor(absoluteMonth / 12),
    monthIndex: ((absoluteMonth % 12) + 12) % 12,
  };
}

export function getRelativeOffsetForYearMonth({
  currentYear,
  currentMonthIndex,
  year,
  monthIndex,
}: {
  currentYear: number;
  currentMonthIndex: number;
  year: number;
  monthIndex: number;
}): RelativeMonthOffset {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new RangeError('Target calendar month must be a valid Common Era year and month.');
  }
  const offset = (year - currentYear) * 12 + monthIndex - currentMonthIndex;
  if (offset > 0) throw new RangeError('Future calendar months are not supported.');
  return offset;
}

export function getEarliestSupportedRelativeOffset(currentYear: number, currentMonthIndex: number) {
  return getRelativeOffsetForYearMonth({
    currentYear,
    currentMonthIndex,
    year: 1,
    monthIndex: 0,
  });
}

export function createInitialRelativeMonthOffsets(
  currentYear: number,
  currentMonthIndex: number,
  batchSize = CALENDAR_INITIAL_MONTH_BATCH,
) {
  const earliest = getEarliestSupportedRelativeOffset(currentYear, currentMonthIndex);
  const oldestLoaded = Math.max(earliest, -(Math.max(1, Math.floor(batchSize)) - 1));
  return Array.from({ length: -oldestLoaded + 1 }, (_, index) => oldestLoaded + index);
}

export function createRelativeMonthWindowAroundTarget({
  targetOffset,
  currentYear,
  currentMonthIndex,
  windowSize = CALENDAR_INITIAL_MONTH_BATCH,
  olderMonthCount = Math.floor(CALENDAR_INITIAL_MONTH_BATCH / 2),
}: {
  targetOffset: RelativeMonthOffset;
  currentYear: number;
  currentMonthIndex: number;
  windowSize?: number;
  olderMonthCount?: number;
}) {
  if (!Number.isInteger(targetOffset) || targetOffset > 0) {
    throw new RangeError('A non-future target month offset is required.');
  }
  const earliest = getEarliestSupportedRelativeOffset(currentYear, currentMonthIndex);
  if (targetOffset < earliest) throw new RangeError('Target month precedes the Common Era boundary.');
  const safeWindowSize = Math.max(1, Math.floor(windowSize));
  let oldest = Math.max(earliest, targetOffset - Math.max(0, Math.floor(olderMonthCount)));
  let newest = Math.min(0, oldest + safeWindowSize - 1);
  oldest = Math.max(earliest, newest - safeWindowSize + 1);
  if (targetOffset < oldest) oldest = targetOffset;
  if (targetOffset > newest) {
    newest = targetOffset;
    oldest = Math.max(earliest, newest - safeWindowSize + 1);
  }
  return Array.from({ length: newest - oldest + 1 }, (_, index) => oldest + index);
}

export function prependRelativeMonthOffsetBatch({
  loadedOffsets,
  currentYear,
  currentMonthIndex,
  batchSize = CALENDAR_PREPEND_MONTH_BATCH,
}: {
  loadedOffsets: RelativeMonthOffset[];
  currentYear: number;
  currentMonthIndex: number;
  batchSize?: number;
}) {
  const earliest = getEarliestSupportedRelativeOffset(currentYear, currentMonthIndex);
  const oldestLoaded = loadedOffsets[0] ?? 0;
  if (oldestLoaded <= earliest) return loadedOffsets;
  const nextOldest = Math.max(earliest, oldestLoaded - Math.max(1, Math.floor(batchSize)));
  const prepended = Array.from(
    { length: oldestLoaded - nextOldest },
    (_, index) => nextOldest + index,
  );
  return [...prepended, ...loadedOffsets];
}

export function appendNewerRelativeMonthOffsetBatch({
  loadedOffsets,
  batchSize = CALENDAR_PREPEND_MONTH_BATCH,
}: {
  loadedOffsets: RelativeMonthOffset[];
  batchSize?: number;
}) {
  const newestLoaded = loadedOffsets.at(-1) ?? 0;
  if (newestLoaded >= 0) return loadedOffsets;
  const nextNewest = Math.min(0, newestLoaded + Math.max(1, Math.floor(batchSize)));
  const appended = Array.from(
    { length: nextNewest - newestLoaded },
    (_, index) => newestLoaded + index + 1,
  );
  return [...loadedOffsets, ...appended];
}

function getCurrentYearMonth(todayLocalDate: string) {
  const today = localDateStringToLocalDate(todayLocalDate);
  if (!today) return null;
  return { currentYear: today.getFullYear(), currentMonthIndex: today.getMonth() };
}

export function formatCalendarMonthLabel(year: number, monthIndex: number) {
  const date = createLocalCalendarDate(year, monthIndex, 1);
  return date ? monthLabelFormatter.format(date) : '';
}

export function formatCalendarMonthShortLabel(year: number, monthIndex: number) {
  const date = createLocalCalendarDate(year, monthIndex, 1);
  return date ? monthShortLabelFormatter.format(date).replace(/\.$/, '') : '';
}

function padMonthPart(value: number) {
  return String(value).padStart(2, '0');
}

export function toMonthKey(year: number, monthIndex: number) {
  return `${String(year).padStart(4, '0')}-${padMonthPart(monthIndex + 1)}`;
}

export function monthKeyFromLocalDate(localDate: string) {
  if (!isValidLocalDateString(localDate)) return null;
  return localDate.slice(0, 7);
}

export function startOfMonthLocalDate(localDate: string) {
  const date = localDateStringToLocalDate(localDate);
  if (!date) return localDate;
  const first = createLocalCalendarDate(date.getFullYear(), date.getMonth(), 1);
  return first ? toLocalDateString(first) : localDate;
}

export function addLocalMonths(localDate: string, months: number) {
  const date = localDateStringToLocalDate(localDate);
  if (!date || !Number.isInteger(months)) return localDate;
  const absoluteMonth = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(absoluteMonth / 12);
  const monthIndex = ((absoluteMonth % 12) + 12) % 12;
  const next = createLocalCalendarDate(year, monthIndex, 1);
  return next ? toLocalDateString(next) : localDate;
}

export function getCalendarMonthWeekCount(year: number, monthIndex: number) {
  const firstDay = createLocalCalendarDate(year, monthIndex, 1);
  const nextMonth = monthIndex === 11
    ? createLocalCalendarDate(year + 1, 0, 1)
    : createLocalCalendarDate(year, monthIndex + 1, 1);
  if (!firstDay || !nextMonth) return null;
  const lastDay = new Date(nextMonth);
  lastDay.setDate(0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  return Math.ceil((startOffset + lastDay.getDate()) / 7);
}

export function getCalendarMonthExactHeight(weekCount: number) {
  return CALENDAR_MONTH_VERTICAL_PADDING + weekCount * CALENDAR_WEEK_ROW_HEIGHT;
}

export function getRestoredScrollOffsetAfterPrepend({
  headerHeight,
  monthOffset,
  displacementWithinMonth,
}: {
  headerHeight: number;
  monthOffset: number;
  displacementWithinMonth: number;
}) {
  return Math.max(0, headerHeight + monthOffset + displacementWithinMonth);
}

export function buildCalendarMonthLayouts({
  relativeOffsets,
  currentYear,
  currentMonthIndex,
}: {
  relativeOffsets: RelativeMonthOffset[];
  currentYear: number;
  currentMonthIndex: number;
}) {
  let cumulativeOffset = 0;
  return relativeOffsets.map((relativeOffset, index): CalendarMonthLayout => {
    const { year, monthIndex } = getYearMonthFromRelativeOffset({
      currentYear,
      currentMonthIndex,
      offset: relativeOffset,
    });
    const weekCount = getCalendarMonthWeekCount(year, monthIndex);
    if (weekCount == null) throw new RangeError(`Calendar month ${year}-${monthIndex + 1} is not representable.`);
    const length = getCalendarMonthExactHeight(weekCount);
    const layout = { relativeOffset, year, monthIndex, weekCount, length, offset: cumulativeOffset, index };
    cumulativeOffset += length;
    return layout;
  });
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
}) {
  const firstDay = createLocalCalendarDate(year, monthIndex, 1);
  const weekCount = getCalendarMonthWeekCount(year, monthIndex);
  if (!firstDay || weekCount == null) return [];
  const nextMonth = monthIndex === 11
    ? createLocalCalendarDate(year + 1, 0, 1)
    : createLocalCalendarDate(year, monthIndex + 1, 1);
  if (!nextMonth) return [];
  const lastDay = new Date(nextMonth);
  lastDay.setDate(0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-lead-${index}` });
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = createLocalCalendarDate(year, monthIndex, day);
    if (!date) continue;
    const localDate = toLocalDateString(date);
    const stats = dailyStatisticsIndex.get(localDate) ?? createEmptyDriverDailyStatistics(localDate);
    const resolved = resolveConfiguredDailyGoalForDate({ records: goalRecords, selectedLocalDate: localDate });
    const isFuture = isFutureLocalDateString(localDate, todayLocalDate);
    const configured = resolved.status === 'configured';
    cells.push({
      kind: 'date',
      localDate,
      dayNumber: day,
      isToday: localDate === todayLocalDate,
      isSelected: localDate === selectedLocalDate,
      isFuture,
      goalState: configured ? 'configured' : 'unconfigured',
      progress: isFuture ? 0 : progressRatioForConfiguredGoal({ earningsRwf: stats.earningsRwf, resolved }),
      earningsRwf: stats.earningsRwf,
      goalRwf: configured ? resolved.amountRwf : null,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-trail-${cells.length}` });
  }
  return Array.from({ length: weekCount }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function buildDriverStatisticsCalendarMonthAtOffset({
  relativeOffset,
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
}: {
  relativeOffset: RelativeMonthOffset;
  todayLocalDate: string;
  selectedLocalDate: string;
  dailyStatisticsIndex: Map<string, DriverDailyStatistics>;
  goalRecords: DriverDailyGoalRecord[];
}): DriverStatisticsCalendarMonth {
  const current = getCurrentYearMonth(todayLocalDate);
  if (!current) throw new RangeError('A valid current local date is required.');
  const { year, monthIndex } = getYearMonthFromRelativeOffset({ ...current, offset: relativeOffset });
  const weekCount = getCalendarMonthWeekCount(year, monthIndex);
  if (year < 1 || weekCount == null) throw new RangeError('The requested calendar month is outside the supported CE range.');
  return {
    monthKey: toMonthKey(year, monthIndex),
    relativeOffset,
    year,
    monthIndex,
    label: formatCalendarMonthLabel(year, monthIndex),
    weekCount,
    exactHeight: getCalendarMonthExactHeight(weekCount),
    weeks: buildMonthWeeks({ year, monthIndex, todayLocalDate, selectedLocalDate, dailyStatisticsIndex, goalRecords }),
  };
}

export function getRelativeOffsetForLocalDate(localDate: string, todayLocalDate: string) {
  const date = localDateStringToLocalDate(localDate);
  const current = getCurrentYearMonth(todayLocalDate);
  if (!date || !current) return 0;
  try {
    return getRelativeOffsetForYearMonth({
      ...current,
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
    });
  } catch {
    return 0;
  }
}

export function getCalendarMonthLabelForRelativeOffset(relativeOffset: number, todayLocalDate: string) {
  const current = getCurrentYearMonth(todayLocalDate);
  if (!current) return '';
  const { year, monthIndex } = getYearMonthFromRelativeOffset({ ...current, offset: relativeOffset });
  return formatCalendarMonthLabel(year, monthIndex);
}
