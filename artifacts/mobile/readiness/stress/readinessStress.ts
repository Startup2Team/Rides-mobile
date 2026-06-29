import type { ReadinessStressProfile } from '../types';
import {
  CI_SAFE_READINESS_STRESS_PROFILE,
  FULL_READINESS_STRESS_PROFILE,
} from '../types';

export { CI_SAFE_READINESS_STRESS_PROFILE, FULL_READINESS_STRESS_PROFILE };

export function createReadinessStressProfile(
  overrides: Partial<ReadinessStressProfile> = {},
  base: ReadinessStressProfile = CI_SAFE_READINESS_STRESS_PROFILE,
): ReadinessStressProfile {
  return { ...base, ...overrides };
}

export function createDeterministicClock(start = '2026-06-29T10:00:00.000Z') {
  let current = new Date(start);
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    iso() {
      return current.toISOString();
    },
  };
}

