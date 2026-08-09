import { needsDailyCounterReset, withDailyCountersForToday } from '@/domain/driverDailyCounters';
import type { DriverProfile } from '@/types';

const TODAY = new Date(2026, 7, 9, 14, 0, 0); // 9 Aug 2026, local
const TODAY_STAMP = '2026-08-09';

function profile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    dailyRides: 0,
    dailyDeclines: 0,
    acceptanceRate: 100,
    completedRides: 0,
    earningsTotal: 0,
    ...overrides,
  } as DriverProfile;
}

describe('withDailyCountersForToday', () => {
  it('zeroes counters stamped with an earlier day', () => {
    const stale = profile({ dailyRides: 4, dailyDeclines: 11, dailyCountersDate: '2026-08-08' });

    const rolled = withDailyCountersForToday(stale, TODAY);

    expect(rolled.dailyRides).toBe(0);
    expect(rolled.dailyDeclines).toBe(0);
    expect(rolled.dailyCountersDate).toBe(TODAY_STAMP);
  });

  it('leaves today untouched, and returns the same object so no write is needed', () => {
    const current = profile({ dailyRides: 3, dailyDeclines: 2, dailyCountersDate: TODAY_STAMP });

    expect(withDailyCountersForToday(current, TODAY)).toBe(current);
  });

  it('preserves lifetime totals while clearing the daily ones', () => {
    const stale = profile({
      dailyRides: 4,
      dailyDeclines: 11,
      dailyCountersDate: '2026-08-08',
      completedRides: 812,
      earningsTotal: 640_000,
    });

    const rolled = withDailyCountersForToday(stale, TODAY);

    expect(rolled.completedRides).toBe(812);
    expect(rolled.earningsTotal).toBe(640_000);
  });

  it('clears unstamped counters, which cover an unknown span', () => {
    // Profiles written before the stamp existed carry counters that were only
    // ever incremented — for the life of the install. Carrying them into today
    // would keep the stale total alive for one more day.
    const legacy = profile({ dailyRides: 7, dailyDeclines: 23 });

    const rolled = withDailyCountersForToday(legacy, TODAY);

    expect(rolled.dailyRides).toBe(0);
    expect(rolled.dailyDeclines).toBe(0);
    expect(rolled.dailyCountersDate).toBe(TODAY_STAMP);
  });

  it('just stamps an unstamped profile whose counters are already zero', () => {
    const fresh = profile();

    const rolled = withDailyCountersForToday(fresh, TODAY);

    expect(rolled.dailyRides).toBe(0);
    expect(rolled.dailyCountersDate).toBe(TODAY_STAMP);
  });

  it('rolls over at local midnight, not 02:00', () => {
    // The backend used to define a day in UTC, which in Kigali (UTC+2) rolls at
    // 02:00 local. A driver working at 00:30 is already on a new day.
    const stale = profile({ dailyRides: 9, dailyDeclines: 5, dailyCountersDate: '2026-08-08' });
    const justAfterMidnight = new Date(2026, 7, 9, 0, 30, 0);

    expect(withDailyCountersForToday(stale, justAfterMidnight).dailyRides).toBe(0);

    // ...and still counts as the same day at 23:59.
    const lateSameDay = new Date(2026, 7, 9, 23, 59, 0);
    const today = profile({ dailyRides: 9, dailyDeclines: 5, dailyCountersDate: TODAY_STAMP });
    expect(withDailyCountersForToday(today, lateSameDay).dailyRides).toBe(9);
  });

  it('does not roll a second time within the same day', () => {
    const stale = profile({ dailyRides: 4, dailyDeclines: 11, dailyCountersDate: '2026-08-08' });

    const first = withDailyCountersForToday(stale, TODAY);
    const afterCounting = { ...first, dailyRides: 2 };
    const second = withDailyCountersForToday(afterCounting, TODAY);

    expect(second.dailyRides).toBe(2);
    expect(second).toBe(afterCounting);
  });
});

describe('needsDailyCounterReset', () => {
  it('is true only when the stamp is not today', () => {
    expect(needsDailyCounterReset(profile({ dailyCountersDate: TODAY_STAMP }), TODAY)).toBe(false);
    expect(needsDailyCounterReset(profile({ dailyCountersDate: '2026-08-08' }), TODAY)).toBe(true);
    expect(needsDailyCounterReset(profile(), TODAY)).toBe(true);
  });
});
