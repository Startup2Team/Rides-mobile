import {
  DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT,
  DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS,
  MIN_CALENDAR_YEAR,
  buildDriverStatisticsCalendarMonthAtIndex,
  clampCalendarJumpYear,
  createCalendarMonthIndexData,
  formatCalendarMonthShortLabel,
  getCalendarIndexForJumpYear,
  getCalendarIndexForLocalDate,
  getCalendarIndexForMonth,
  getCalendarMonthFromIndex,
  getCalendarTotalMonths,
  parseCalendarJumpYear,
  toMonthKey,
} from '../driverStatisticsCalendar';
import type { DriverDailyGoalRecord } from '../driverDailyGoals';
import { createEmptyDriverDailyStatistics } from '../driverDailyStatistics';

describe('driverStatisticsCalendar', () => {
  test('range begins at January 1500 and ends at the current month', () => {
    const total = getCalendarTotalMonths('2026-07-10');
    expect(total).toBe((2026 - MIN_CALENDAR_YEAR) * 12 + 7);
    expect(total).toBe(6319);

    expect(getCalendarMonthFromIndex(0)).toEqual({
      year: MIN_CALENDAR_YEAR,
      monthIndex: 0,
    });
    expect(toMonthKey(MIN_CALENDAR_YEAR, 0)).toBe('1500-01');

    const last = getCalendarMonthFromIndex(total - 1);
    expect(last).toEqual({ year: 2026, monthIndex: 6 });
    expect(toMonthKey(last.year, last.monthIndex)).toBe('2026-07');
  });

  test('future months are excluded from the total count', () => {
    expect(getCalendarTotalMonths('2026-07-31')).toBe(6319);
    expect(getCalendarMonthFromIndex(getCalendarTotalMonths('2026-07-10'))).toEqual({
      year: 2026,
      monthIndex: 7,
    });
    // Index equal to total is outside the list; last valid is current month only.
    expect(getCalendarIndexForLocalDate('2026-08-01', '2026-07-10')).toBe(6318);
  });

  test('month index maps to year/month and back', () => {
    expect(getCalendarMonthFromIndex(0, MIN_CALENDAR_YEAR)).toEqual({
      year: 1500,
      monthIndex: 0,
    });
    expect(getCalendarMonthFromIndex(12, MIN_CALENDAR_YEAR)).toEqual({
      year: 1501,
      monthIndex: 0,
    });
    expect(getCalendarMonthFromIndex(6318, MIN_CALENDAR_YEAR)).toEqual({
      year: 2026,
      monthIndex: 6,
    });

    expect(getCalendarIndexForMonth(1500, 0)).toBe(0);
    expect(getCalendarIndexForMonth(2026, 6)).toBe(6318);
    expect(getCalendarIndexForMonth(2000, 0)).toBe((2000 - 1500) * 12);
  });

  test('current and selected month initial indexes are correct', () => {
    expect(getCalendarIndexForLocalDate('2026-07-10', '2026-07-10')).toBe(6318);
    expect(getCalendarIndexForLocalDate('2026-07-08', '2026-07-10')).toBe(6318);
    expect(getCalendarIndexForLocalDate('1500-01-15', '2026-07-10')).toBe(0);
    expect(getCalendarIndexForLocalDate('2000-03-01', '2026-07-10')).toBe(
      getCalendarIndexForMonth(2000, 2),
    );
  });

  test('lightweight index data does not eagerly build month grids', () => {
    const indexes = createCalendarMonthIndexData('2026-07-10');
    expect(indexes).toHaveLength(6319);
    expect(indexes[0]).toBe(0);
    expect(indexes[6318]).toBe(6318);
    expect(indexes.every((value, index) => value === index)).toBe(true);
  });

  test('builds a single month lazily with Monday-first weeks and future disabled', () => {
    const index = new Map([
      [
        '2026-07-08',
        {
          ...createEmptyDriverDailyStatistics('2026-07-08'),
          earningsRwf: 12_000,
        },
      ],
    ]);
    const goals: DriverDailyGoalRecord[] = [
      {
        amountRwf: 30_000,
        effectiveFromLocalDate: '2026-07-08',
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z',
      },
    ];

    const july = buildDriverStatisticsCalendarMonthAtIndex({
      index: getCalendarIndexForMonth(2026, 6),
      todayLocalDate: '2026-07-10',
      selectedLocalDate: '2026-07-08',
      dailyStatisticsIndex: index,
      goalRecords: goals,
    });

    expect(july.monthKey).toBe('2026-07');
    expect(july.label).toBe('July 2026');
    expect(formatCalendarMonthShortLabel(2026, 6)).toBe('Jul');
    expect(formatCalendarMonthShortLabel(2026, 0)).toBe('Jan');
    expect(july.weeks[0][0].kind).toBe('empty');
    expect(july.weeks[0][2]).toMatchObject({
      kind: 'date',
      localDate: '2026-07-01',
    });

    const selected = july.weeks.flat().find(
      (cell) => cell.kind === 'date' && cell.localDate === '2026-07-08',
    );
    expect(selected).toMatchObject({
      kind: 'date',
      isSelected: true,
      goalState: 'configured',
      progress: 0.4,
      earningsRwf: 12_000,
      goalRwf: 30_000,
    });

    const beforeGoal = july.weeks.flat().find(
      (cell) => cell.kind === 'date' && cell.localDate === '2026-07-07',
    );
    expect(beforeGoal).toMatchObject({
      kind: 'date',
      goalState: 'unconfigured',
      progress: 0,
    });

    const future = july.weeks.flat().find(
      (cell) => cell.kind === 'date' && cell.localDate === '2026-07-11',
    );
    expect(future).toMatchObject({
      kind: 'date',
      isFuture: true,
      progress: 0,
    });

    expect(DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS).toHaveLength(7);
    expect(DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT).toBeGreaterThan(200);
  });

  test('very old dates before account creation render unconfigured empty state', () => {
    const month = buildDriverStatisticsCalendarMonthAtIndex({
      index: 0,
      todayLocalDate: '2026-07-10',
      selectedLocalDate: '1500-01-15',
      dailyStatisticsIndex: new Map(),
      goalRecords: [],
    });

    expect(month.monthKey).toBe('1500-01');
    expect(month.label).toBe('January 1500');
    const selected = month.weeks.flat().find(
      (cell) => cell.kind === 'date' && cell.localDate === '1500-01-15',
    );
    expect(selected).toMatchObject({
      kind: 'date',
      isSelected: true,
      isFuture: false,
      goalState: 'unconfigured',
      progress: 0,
      earningsRwf: 0,
      goalRwf: null,
    });
  });

  test('jump-to-year clamps helper and parse rejects out-of-range input', () => {
    expect(clampCalendarJumpYear(1400, '2026-07-10')).toBe(1500);
    expect(clampCalendarJumpYear(3000, '2026-07-10')).toBe(2026);
    expect(getCalendarIndexForJumpYear(1500, '2026-07-10')).toBe(0);
    expect(getCalendarIndexForJumpYear(2026, '2026-07-10')).toBe(6318);
    expect(getCalendarIndexForJumpYear(2000, '2026-07-10')).toBe(
      getCalendarIndexForMonth(2000, 0),
    );

    expect(parseCalendarJumpYear('1500', '2026-07-10')).toEqual({ ok: true, year: 1500 });
    expect(parseCalendarJumpYear('2026', '2026-07-10')).toEqual({ ok: true, year: 2026 });
    expect(parseCalendarJumpYear('1499', '2026-07-10')).toEqual({ ok: false, reason: 'too-low' });
    expect(parseCalendarJumpYear('2027', '2026-07-10')).toEqual({ ok: false, reason: 'too-high' });
    expect(parseCalendarJumpYear('20.26', '2026-07-10')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCalendarJumpYear('', '2026-07-10')).toEqual({ ok: false, reason: 'empty' });
  });
});
