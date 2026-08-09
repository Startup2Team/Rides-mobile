import { toLocalDateString } from '@/domains/driver-statistics/driverDailyGoals';
import type { DriverProfile } from '@/types';

/**
 * Roll `dailyRides` / `dailyDeclines` over at local midnight.
 *
 * These counters were only ever incremented. The only places that set them to 0
 * are profile-CREATION sites, which run on a fresh login and never again, so on
 * a device that stayed logged in they accumulated for the life of the install.
 * A driver who had ever declined 10 rides carried the "reduced priority" warning
 * permanently, and the local acceptance rate could never recover from a bad first
 * week — the denominator only grew.
 *
 * The day is the DEVICE's local calendar day, which is the one the driver reads
 * off their own phone. It deliberately matches the backend, where a day is now
 * the local calendar day in the platform timezone rather than a UTC one.
 *
 * Returns the same object when nothing changed, so callers can skip a write.
 */
export function withDailyCountersForToday(profile: DriverProfile, now = new Date()): DriverProfile {
  const today = toLocalDateString(now);
  if (profile.dailyCountersDate === today) return profile;

  // A profile written before this field existed has no stamp. Its counters cover
  // an unknown span, so they are reset rather than trusted — carrying them into
  // today would keep the stale total alive for one more day.
  if (profile.dailyCountersDate === undefined
    && (profile.dailyRides ?? 0) === 0
    && (profile.dailyDeclines ?? 0) === 0) {
    return { ...profile, dailyCountersDate: today };
  }

  return { ...profile, dailyRides: 0, dailyDeclines: 0, dailyCountersDate: today };
}

/** Whether withDailyCountersForToday would change anything — i.e. worth persisting. */
export function needsDailyCounterReset(profile: DriverProfile, now = new Date()): boolean {
  return profile.dailyCountersDate !== toLocalDateString(now);
}
