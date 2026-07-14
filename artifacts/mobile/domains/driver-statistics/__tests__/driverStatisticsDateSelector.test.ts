import {
  clampDateSelectorPrefillDay,
  validateDateSelectorDraft,
} from '../driverStatisticsDateSelector';
import {
  createRelativeMonthWindowAroundTarget,
  getRelativeOffsetForYearMonth,
} from '../driverStatisticsCalendar';

const todayLocalDate = '2026-07-12';

function validate(year: string, month: string, day: string) {
  return validateDateSelectorDraft({ yearInput: year, monthInput: month, dayInput: day, todayLocalDate });
}

describe('driver statistics date selector', () => {
  test.each([
    ['2026', '7', '12', '2026-07-12'],
    ['1500', '1', '1', '1500-01-01'],
    ['99', '7', '12', '0099-07-12'],
    ['1', '1', '1', '0001-01-01'],
    ['1600', '2', '29', '1600-02-29'],
    ['2000', '2', '29', '2000-02-29'],
  ])('accepts %s-%s-%s', (year, month, day, localDate) => {
    expect(validate(year, month, day)).toEqual(expect.objectContaining({ valid: true, localDate }));
  });

  test.each([
    ['0', '1', '1', 'Year must be 1 or later'],
    ['-1', '1', '1', 'Year must be 1 or later'],
    ['1700', '2', '29', 'Enter a valid date'],
    ['1900', '2', '29', 'Enter a valid date'],
    ['2026', '7', '13', 'This date is in the future'],
    ['2026', '13', '1', 'Enter a valid date'],
  ])('rejects %s-%s-%s', (year, month, day, message) => {
    expect(validate(year, month, day)).toEqual({ valid: false, message });
  });

  test('clamps selector prefill day to the target month', () => {
    expect(clampDateSelectorPrefillDay({ year: 2026, month: 2, preferredDay: 31 })).toBe(28);
    expect(clampDateSelectorPrefillDay({ year: 1600, month: 2, preferredDay: 31 })).toBe(29);
  });

  test('direct ancient rebase contains target without future offsets or duplicates', () => {
    const current = { currentYear: 2026, currentMonthIndex: 6 };
    const targetOffset = getRelativeOffsetForYearMonth({ ...current, year: 1499, monthIndex: 11 });
    const offsets = createRelativeMonthWindowAroundTarget({ ...current, targetOffset });
    expect(targetOffset).toBe(-6319);
    expect(offsets).toContain(targetOffset);
    expect(offsets.every((offset) => offset <= 0)).toBe(true);
    expect(new Set(offsets).size).toBe(offsets.length);
    expect(offsets.length).toBeLessThanOrEqual(240);
  });

  test('year 1 target rebases safely at the CE boundary', () => {
    const current = { currentYear: 2026, currentMonthIndex: 6 };
    const targetOffset = getRelativeOffsetForYearMonth({ ...current, year: 1, monthIndex: 0 });
    const offsets = createRelativeMonthWindowAroundTarget({ ...current, targetOffset });
    expect(offsets[0]).toBe(targetOffset);
    expect(offsets).toContain(targetOffset);
  });
});
