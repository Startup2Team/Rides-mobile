import { isValidLocalDateString, toLocalDateString } from './driverDailyGoals';

export function localDateStringToLocalDate(localDate: string) {
  if (!isValidLocalDateString(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
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
