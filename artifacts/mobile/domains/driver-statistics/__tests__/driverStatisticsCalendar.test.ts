import {
  CALENDAR_INITIAL_MONTH_BATCH,
  buildCalendarMonthLayouts,
  buildDriverStatisticsCalendarMonthAtOffset,
  createInitialRelativeMonthOffsets,
  getCalendarMonthWeekCount,
  getRestoredScrollOffsetAfterPrepend,
  getRelativeOffsetForYearMonth,
  getYearMonthFromRelativeOffset,
  prependRelativeMonthOffsetBatch,
  toMonthKey,
} from '../driverStatisticsCalendar';
import { createLocalCalendarDate, localDateStringToLocalDate } from '../driverLocalDates';
import { isValidLocalDateString, toLocalDateString } from '../driverDailyGoals';

const CURRENT = { currentYear: 2026, currentMonthIndex: 6 };

describe('relative driver statistics calendar', () => {
  test.each([
    [0, 2026, 6],
    [-1, 2026, 5],
    [-12, 2025, 6],
    [-6318, 1500, 0],
    [-6319, 1499, 11],
  ])('offset %s maps to %s-%s', (offset, year, monthIndex) => {
    expect(getYearMonthFromRelativeOffset({ ...CURRENT, offset })).toEqual({ year, monthIndex });
    expect(getRelativeOffsetForYearMonth({ ...CURRENT, year, monthIndex })).toBe(offset);
  });

  test('future offsets and future target months are rejected', () => {
    expect(() => getYearMonthFromRelativeOffset({ ...CURRENT, offset: 1 })).toThrow();
    expect(() => getRelativeOffsetForYearMonth({ ...CURRENT, year: 2026, monthIndex: 7 })).toThrow();
  });

  test('initial window is lightweight, finite, ordered, and ends at current month', () => {
    const offsets = createInitialRelativeMonthOffsets(2026, 6);
    expect(offsets).toHaveLength(CALENDAR_INITIAL_MONTH_BATCH);
    expect(offsets[0]).toBe(-239);
    expect(offsets.at(-1)).toBe(0);
    expect(offsets.every((value, index) => value === index - 239)).toBe(true);
  });

  test('multiple prepends preserve identities without duplicates and continue beyond 1500', () => {
    let offsets = createInitialRelativeMonthOffsets(2026, 6);
    const original = offsets;
    for (let index = 0; index < 27; index += 1) {
      offsets = prependRelativeMonthOffsetBatch({ loadedOffsets: offsets, ...CURRENT });
    }
    expect(offsets).toContain(-6318);
    expect(offsets).toContain(-6319);
    expect(new Set(offsets).size).toBe(offsets.length);
    expect(offsets.slice(-original.length)).toEqual(original);
    expect(offsets.at(-1)).toBe(0);
  });

  test('stable month keys are independent of prepend index', () => {
    const before = getYearMonthFromRelativeOffset({ ...CURRENT, offset: -12 });
    const offsets = prependRelativeMonthOffsetBatch({
      loadedOffsets: createInitialRelativeMonthOffsets(2026, 6),
      ...CURRENT,
    });
    const after = getYearMonthFromRelativeOffset({ ...CURRENT, offset: offsets[offsets.indexOf(-12)] });
    expect(toMonthKey(before.year, before.monthIndex)).toBe(toMonthKey(after.year, after.monthIndex));
  });

  test('exact cumulative layouts remain correct after prepend', () => {
    const initial = createInitialRelativeMonthOffsets(2026, 6);
    const prepended = prependRelativeMonthOffsetBatch({ loadedOffsets: initial, ...CURRENT });
    const layouts = buildCalendarMonthLayouts({ relativeOffsets: prepended, ...CURRENT });
    layouts.forEach((layout, index) => {
      expect(layout.weekCount).toBe(getCalendarMonthWeekCount(layout.year, layout.monthIndex));
      expect(layout.offset).toBe(index === 0 ? 0 : layouts[index - 1].offset + layouts[index - 1].length);
    });
    expect(layouts.find((layout) => layout.relativeOffset === 0)?.year).toBe(2026);
  });

  test('prepend restoration keeps the same visible month displacement', () => {
    expect(getRestoredScrollOffsetAfterPrepend({
      headerHeight: 80,
      monthOffset: 10_000,
      displacementWithinMonth: 37,
    })).toBe(10_117);
  });

  test.each([
    [1600, 29],
    [1700, 28],
    [1900, 28],
    [2000, 29],
  ])('February %s has %s days', (year, expectedDays) => {
    const march = createLocalCalendarDate(year, 2, 1);
    expect(march).not.toBeNull();
    const lastFebruaryDay = new Date(march as Date);
    lastFebruaryDay.setDate(0);
    expect(lastFebruaryDay.getDate()).toBe(expectedDays);
  });

  test.each([1500, 100, 99, 1])('constructs and round-trips year %s safely', (year) => {
    const date = createLocalCalendarDate(year, 1, 1);
    expect(date?.getFullYear()).toBe(year);
    expect(date?.getMonth()).toBe(1);
    const localDate = date ? toLocalDateString(date) : '';
    expect(localDate).toBe(`${String(year).padStart(4, '0')}-02-01`);
    expect(localDateStringToLocalDate(localDate)?.getFullYear()).toBe(year);
  });

  test('year 1 is the CE boundary and BCE construction is rejected gracefully', () => {
    expect(createLocalCalendarDate(1, 0, 1)).not.toBeNull();
    expect(createLocalCalendarDate(0, 0, 1)).toBeNull();
    expect(createLocalCalendarDate(-1, 0, 1)).toBeNull();
    const offsets = prependRelativeMonthOffsetBatch({
      loadedOffsets: [-24_300, 0],
      ...CURRENT,
    });
    expect(offsets[0]).toBe(-24_306);
  });

  test('semantic local-date validation rejects impossible dates and supports extended CE years', () => {
    expect(isValidLocalDateString('0099-02-01')).toBe(true);
    expect(isValidLocalDateString('0001-01-01')).toBe(true);
    expect(isValidLocalDateString('2026-02-31')).toBe(false);
    expect(isValidLocalDateString('-001-01-01')).toBe(false);
  });

  test('ancient date cells are selectable truthful empty/unconfigured states', () => {
    const offset = getRelativeOffsetForYearMonth({ ...CURRENT, year: 99, monthIndex: 0 });
    const month = buildDriverStatisticsCalendarMonthAtOffset({
      relativeOffset: offset,
      todayLocalDate: '2026-07-10',
      selectedLocalDate: '0099-01-15',
      dailyStatisticsIndex: new Map(),
      goalRecords: [],
    });
    const selected = month.weeks.flat().find(
      (cell) => cell.kind === 'date' && cell.localDate === '0099-01-15',
    );
    expect(selected).toMatchObject({
      kind: 'date', isSelected: true, isFuture: false, earningsRwf: 0,
      goalState: 'unconfigured', goalRwf: null, progress: 0,
    });
  });
});
