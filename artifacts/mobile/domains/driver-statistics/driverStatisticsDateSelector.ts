import { isFutureLocalDateString, createLocalCalendarDate } from './driverLocalDates';
import { toLocalDateString } from './driverDailyGoals';

export type LocalCalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

export type DateSelectorValidationResult =
  | { valid: true; parts: LocalCalendarDateParts; localDate: string }
  | { valid: false; message: string };

function parsePositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateDateSelectorDraft({
  dayInput,
  monthInput,
  yearInput,
  todayLocalDate,
}: {
  dayInput: string;
  monthInput: string;
  yearInput: string;
  todayLocalDate: string;
}): DateSelectorValidationResult {
  const day = parsePositiveInteger(dayInput);
  const month = parsePositiveInteger(monthInput);
  const year = parsePositiveInteger(yearInput);
  if (year == null || year < 1) {
    return { valid: false, message: 'Year must be 1 or later' };
  }
  if (day == null || month == null || month < 1 || month > 12 || day < 1) {
    return { valid: false, message: 'Enter a valid date' };
  }
  const date = createLocalCalendarDate(year, month - 1, day);
  if (!date) return { valid: false, message: 'Enter a valid date' };
  const localDate = toLocalDateString(date);
  if (isFutureLocalDateString(localDate, todayLocalDate)) {
    return { valid: false, message: 'This date is in the future' };
  }
  return { valid: true, parts: { year, month, day }, localDate };
}

export function getDaysInCalendarMonth(year: number, month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const nextMonth = month === 12
    ? createLocalCalendarDate(year + 1, 0, 1)
    : createLocalCalendarDate(year, month, 1);
  if (!nextMonth) return null;
  const lastDay = new Date(nextMonth);
  lastDay.setDate(0);
  return lastDay.getDate();
}

export function clampDateSelectorPrefillDay({
  year,
  month,
  preferredDay,
}: {
  year: number;
  month: number;
  preferredDay: number;
}) {
  const daysInMonth = getDaysInCalendarMonth(year, month);
  if (daysInMonth == null) return 1;
  return Math.min(daysInMonth, Math.max(1, Math.floor(preferredDay)));
}

export function getLocalCalendarDateParts(localDate: string): LocalCalendarDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const result = validateDateSelectorDraft({
    yearInput: match[1],
    monthInput: match[2],
    dayInput: match[3],
    todayLocalDate: '9999-12-31',
  });
  return result.valid ? result.parts : null;
}
