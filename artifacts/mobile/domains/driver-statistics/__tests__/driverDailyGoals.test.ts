import {
  DEFAULT_DAILY_GOAL_RWF,
  SUGGESTED_DAILY_GOAL_RWF,
  isCurrentLocalDate,
  MAX_DAILY_GOAL_RWF,
  MIN_DAILY_GOAL_RWF,
  progressRatioForConfiguredGoal,
  resolveConfiguredDailyGoalForDate,
  resolveDailyGoalForDate,
  toLocalDateString,
  upsertDailyGoalForEffectiveDate,
  validateDailyGoalAmount,
  type DriverDailyGoalRecord,
} from '../driverDailyGoals';
import { driverDailyGoalsSchema } from '@/persistence/storageSchemas';

function record(effectiveFromLocalDate: string, amountRwf: number): DriverDailyGoalRecord {
  return {
    amountRwf,
    effectiveFromLocalDate,
    createdAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
    updatedAt: `${effectiveFromLocalDate}T08:00:00.000Z`,
  };
}

describe('driver daily goals', () => {
  test('empty history returns not-configured', () => {
    expect(resolveConfiguredDailyGoalForDate({
      records: [],
      selectedLocalDate: '2026-07-10',
    })).toEqual({ status: 'not-configured', amountRwf: null });
  });

  test('saved record returns configured', () => {
    expect(resolveConfiguredDailyGoalForDate({
      records: [record('2026-07-10', 30_000)],
      selectedLocalDate: '2026-07-10',
    })).toEqual({
      status: 'configured',
      amountRwf: 30_000,
      effectiveFromLocalDate: '2026-07-10',
    });
  });

  test('a later selected date inherits the configured record', () => {
    expect(resolveConfiguredDailyGoalForDate({
      records: [record('2026-07-10', 30_000)],
      selectedLocalDate: '2026-07-13',
    }).status).toBe('configured');
  });

  test('a date before the first record returns not-configured', () => {
    expect(resolveConfiguredDailyGoalForDate({
      records: [record('2026-07-12', 30_000)],
      selectedLocalDate: '2026-07-10',
    })).toEqual({ status: 'not-configured', amountRwf: null });
  });

  test('suggested 30,000 is never returned as configured', () => {
    const resolved = resolveConfiguredDailyGoalForDate({
      records: [],
      selectedLocalDate: '2026-07-10',
    });
    expect(resolved.status).toBe('not-configured');
    expect(SUGGESTED_DAILY_GOAL_RWF).toBe(30_000);
    expect(resolved.amountRwf).not.toBe(SUGGESTED_DAILY_GOAL_RWF);
  });

  test('same-day saved goal is resolved correctly', () => {
    expect(resolveConfiguredDailyGoalForDate({
      records: [record('2026-07-10', 40_000)],
      selectedLocalDate: '2026-07-10',
    }).amountRwf).toBe(40_000);
  });

  test('invalid records do not produce configured state', () => {
    const invalid = {
      amountRwf: 500,
      effectiveFromLocalDate: '2026-07-10',
      createdAt: '2026-07-10T08:00:00.000Z',
      updatedAt: '2026-07-10T08:00:00.000Z',
    } as DriverDailyGoalRecord;

    expect(resolveConfiguredDailyGoalForDate({
      records: [invalid],
      selectedLocalDate: '2026-07-10',
    }).status).toBe('not-configured');
  });

  test('progress is zero when not configured even with earnings', () => {
    expect(progressRatioForConfiguredGoal({
      earningsRwf: 12_500,
      resolved: { status: 'not-configured', amountRwf: null },
    })).toBe(0);
  });

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

  test('legacy numeric helper still falls back when empty', () => {
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

  test('uses the same minimum in domain validation and persistence', () => {
    const minimumRecord = record('2026-07-10', MIN_DAILY_GOAL_RWF);
    const belowMinimumRecord = record('2026-07-10', MIN_DAILY_GOAL_RWF - 1);

    expect(validateDailyGoalAmount(MIN_DAILY_GOAL_RWF)).toBe(true);
    expect(driverDailyGoalsSchema.safeParse([minimumRecord]).success).toBe(true);
    expect(validateDailyGoalAmount(MIN_DAILY_GOAL_RWF - 1)).toBe(false);
    expect(driverDailyGoalsSchema.safeParse([belowMinimumRecord]).success).toBe(false);
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
