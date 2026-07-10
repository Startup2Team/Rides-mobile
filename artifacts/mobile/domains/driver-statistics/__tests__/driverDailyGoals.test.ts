import {
  DEFAULT_DAILY_GOAL_RWF,
  isCurrentLocalDate,
  MAX_DAILY_GOAL_RWF,
  MIN_DAILY_GOAL_RWF,
  resolveDailyGoalForDate,
  toLocalDateString,
  upsertDailyGoalForEffectiveDate,
  validateDailyGoalAmount,
  type DriverDailyGoalRecord,
} from '../driverDailyGoals';

function record(effectiveFromLocalDate: string, amountRwf: number): DriverDailyGoalRecord {
  return {
    amountRwf,
    effectiveFromLocalDate,
    createdAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
    updatedAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
  };
}

describe('driver daily goals', () => {
  test('resolves the newest goal effective on or before the selected date', () => {
    const records = [
      record('2026-07-01', 20_000),
      record('2026-07-10', 30_000),
    ];

    expect(resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-10' })).toBe(30_000);
  });

  test('does not apply todays goal to past dates', () => {
    const records = [
      record('2026-07-01', 20_000),
      record('2026-07-10', 30_000),
    ];

    expect(resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-09' })).toBe(20_000);
  });

  test('applies todays goal to future dates until a later record exists', () => {
    const records = [
      record('2026-07-01', 20_000),
      record('2026-07-10', 30_000),
    ];

    expect(resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-11' })).toBe(30_000);
  });

  test('replaces an existing record for the same effective date and preserves earlier records', () => {
    const records = [
      record('2026-07-01', 20_000),
      record('2026-07-10', 30_000),
    ];

    const updated = upsertDailyGoalForEffectiveDate({
      records,
      effectiveFromLocalDate: '2026-07-10',
      amountRwf: 35_000,
      now: '2026-07-10T12:00:00.000Z',
    });

    expect(updated).toHaveLength(2);
    expect(updated[0]).toMatchObject({ effectiveFromLocalDate: '2026-07-01', amountRwf: 20_000 });
    expect(updated[1]).toMatchObject({ effectiveFromLocalDate: '2026-07-10', amountRwf: 35_000 });
    expect(updated[1].createdAt).toBe('2026-07-10T08:00:00.000Z');
    expect(updated[1].updatedAt).toBe('2026-07-10T12:00:00.000Z');
  });

  test('handles records supplied out of order', () => {
    const records = [
      record('2026-07-10', 30_000),
      record('2026-07-01', 20_000),
    ];

    expect(resolveDailyGoalForDate({ records, selectedLocalDate: '2026-07-09' })).toBe(20_000);
  });

  test('uses fallback behavior when there are no records', () => {
    expect(resolveDailyGoalForDate({
      records: [],
      selectedLocalDate: '2026-07-10',
      fallbackGoal: 42_000,
    })).toBe(42_000);
    expect(resolveDailyGoalForDate({ records: [], selectedLocalDate: '2026-07-10' })).toBe(DEFAULT_DAILY_GOAL_RWF);
  });

  test('rejects invalid amounts', () => {
    expect(validateDailyGoalAmount(MIN_DAILY_GOAL_RWF)).toBe(true);
    expect(validateDailyGoalAmount(MAX_DAILY_GOAL_RWF)).toBe(true);
    expect(validateDailyGoalAmount(0)).toBe(false);
    expect(validateDailyGoalAmount(1_500.5)).toBe(false);

    expect(() => upsertDailyGoalForEffectiveDate({
      records: [],
      effectiveFromLocalDate: '2026-07-10',
      amountRwf: -1,
    })).toThrow(/Daily goal/);
  });

  test('handles local date boundaries using local calendar fields', () => {
    const lateNight = new Date(2026, 6, 10, 23, 59, 59);
    const nextMorning = new Date(2026, 6, 11, 0, 0, 1);

    expect(toLocalDateString(lateNight)).toBe('2026-07-10');
    expect(toLocalDateString(nextMorning)).toBe('2026-07-11');
    expect(isCurrentLocalDate(lateNight, new Date(2026, 6, 10, 8, 0, 0))).toBe(true);
    expect(isCurrentLocalDate(nextMorning, new Date(2026, 6, 10, 23, 59, 59))).toBe(false);
  });
});
