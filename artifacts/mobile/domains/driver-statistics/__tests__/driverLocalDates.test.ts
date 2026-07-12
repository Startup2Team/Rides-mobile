import {
  addLocalDays,
  isFutureLocalDateString,
  localDateStringToLocalDate,
  millisecondsUntilNextLocalMidnight,
  startOfLocalWeekDate,
  toLocalDateString,
} from '@/domains/driver-statistics';

describe('driver local-date lifecycle helpers', () => {
  test('parses YYYY-MM-DD through local calendar components rather than UTC parsing', () => {
    const parsed = localDateStringToLocalDate('2026-07-08');

    expect(parsed).not.toBeNull();
    expect(toLocalDateString(parsed as Date)).toBe('2026-07-08');
    expect(localDateStringToLocalDate('2026-02-30')).toBeNull();
  });

  test('adds local calendar days and resolves Monday week starts', () => {
    expect(addLocalDays('2026-07-08', -1)).toBe('2026-07-07');
    expect(addLocalDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(startOfLocalWeekDate('2026-07-12')).toBe('2026-07-06');
  });

  test('compares valid local dates predictably', () => {
    expect(isFutureLocalDateString('2026-07-09', '2026-07-08')).toBe(true);
    expect(isFutureLocalDateString('2026-07-08', '2026-07-08')).toBe(false);
    expect(isFutureLocalDateString('invalid', '2026-07-08')).toBe(false);
  });

  test('schedules exactly to the next local midnight', () => {
    const now = new Date(2026, 6, 8, 23, 59, 30, 0);
    expect(millisecondsUntilNextLocalMidnight(now)).toBe(30_000);
  });
});
