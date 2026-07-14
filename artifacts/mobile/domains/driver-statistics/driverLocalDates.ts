import { isValidLocalDateString, toLocalDateString } from './driverDailyGoals';

export function localDateStringToLocalDate(localDate: string) {
  if (!isValidLocalDateString(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  return createLocalCalendarDate(year, month - 1, day);
}

/** Constructs a local-noon CE calendar date without Date's special 0-99 year mapping. */
export function createLocalCalendarDate(year: number, monthIndex: number, day: number) {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(0);
  date.setFullYear(year, monthIndex, day);
  date.setHours(12, 0, 0, 0);
  if (
    Number.isNaN(date.getTime())
    ||
    date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addLocalDays(localDate: string, days: number) {
  const date = localDateStringToLocalDate(localDate);
  if (!date || !Number.isInteger(days)) return localDate;
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function startOfLocalWeekDate(localDate: string) {
  const date = localDateStringToLocalDate(localDate);
  if (!date) return localDate;
  const day = date.getDay();
  return addLocalDays(localDate, day === 0 ? -6 : 1 - day);
}

export function isFutureLocalDateString(localDate: string, todayLocalDate: string) {
  return isValidLocalDateString(localDate)
    && isValidLocalDateString(todayLocalDate)
    && localDate > todayLocalDate;
}

export function millisecondsUntilNextLocalMidnight(now = new Date()) {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, nextMidnight.getTime() - now.getTime());
}
