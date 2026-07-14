export interface DriverDailyGoalRecord {
  amountRwf: number;
  effectiveFromLocalDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ResolvedDriverDailyGoal =
  | {
      status: 'configured';
      amountRwf: number;
      effectiveFromLocalDate: string;
    }
  | {
      status: 'not-configured';
      amountRwf: null;
    };

export const DAILY_GOAL_STEP_RWF = 1_000;
export const MIN_DAILY_GOAL_RWF = 1_000;
export const MAX_DAILY_GOAL_RWF = 1_000_000;
/** Suggested first-time draft only — never treat as a saved personal goal. */
export const SUGGESTED_DAILY_GOAL_RWF = 30_000;
/** @deprecated Use SUGGESTED_DAILY_GOAL_RWF for draft prefill only. */
export const DEFAULT_DAILY_GOAL_RWF = SUGGESTED_DAILY_GOAL_RWF;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function toLocalDateString(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

export function isCurrentLocalDate(selectedDate: Date, now = new Date()) {
  return selectedDate.getFullYear() === now.getFullYear()
    && selectedDate.getMonth() === now.getMonth()
    && selectedDate.getDate() === now.getDate();
}

export function isValidLocalDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_PATTERN.test(value)) return false;
  const [year, monthIndex, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, monthIndex - 1, day);
  date.setHours(12, 0, 0, 0);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === year
    && date.getMonth() === monthIndex - 1
    && date.getDate() === day;
}

export function validateDailyGoalAmount(amountRwf: unknown): amountRwf is number {
  return typeof amountRwf === 'number'
    && Number.isInteger(amountRwf)
    && amountRwf >= MIN_DAILY_GOAL_RWF
    && amountRwf <= MAX_DAILY_GOAL_RWF;
}

const normalizedGoalRecordCache = new WeakMap<DriverDailyGoalRecord[], DriverDailyGoalRecord[]>();

function normalizeRecords(records: DriverDailyGoalRecord[]) {
  const cached = normalizedGoalRecordCache.get(records);
  if (cached) return cached;
  const normalized = records
    .filter(record =>
      validateDailyGoalAmount(record.amountRwf)
      && isValidLocalDateString(record.effectiveFromLocalDate)
      && typeof record.createdAt === 'string'
      && typeof record.updatedAt === 'string',
    )
    .sort((a, b) => a.effectiveFromLocalDate.localeCompare(b.effectiveFromLocalDate));
  normalizedGoalRecordCache.set(records, normalized);
  return normalized;
}

/**
 * Resolves whether a real persisted goal is effective on the selected local date.
 * Does not return the suggested 30,000 amount as configured.
 */
export function resolveConfiguredDailyGoalForDate({
  records,
  selectedLocalDate,
}: {
  records: DriverDailyGoalRecord[];
  selectedLocalDate: string;
}): ResolvedDriverDailyGoal {
  if (!isValidLocalDateString(selectedLocalDate)) {
    return { status: 'not-configured', amountRwf: null };
  }

  const normalized = normalizeRecords(records);
  let low = 0;
  let high = normalized.length - 1;
  let resolved: DriverDailyGoalRecord | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = normalized[middle];
    if (candidate.effectiveFromLocalDate <= selectedLocalDate) {
      resolved = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (!resolved) {
    return { status: 'not-configured', amountRwf: null };
  }

  return {
    status: 'configured',
    amountRwf: resolved.amountRwf,
    effectiveFromLocalDate: resolved.effectiveFromLocalDate,
  };
}

/**
 * @deprecated Prefer resolveConfiguredDailyGoalForDate. Numeric fallback is for
 * non-UI helpers only and must not drive progress or “saved goal” labels.
 */
export function resolveDailyGoalForDate({
  records,
  selectedLocalDate,
  fallbackGoal = SUGGESTED_DAILY_GOAL_RWF,
}: {
  records: DriverDailyGoalRecord[];
  selectedLocalDate: string;
  fallbackGoal?: number;
}) {
  const configured = resolveConfiguredDailyGoalForDate({ records, selectedLocalDate });
  if (configured.status === 'configured') return configured.amountRwf;
  const fallback = validateDailyGoalAmount(fallbackGoal) ? fallbackGoal : SUGGESTED_DAILY_GOAL_RWF;
  return fallback;
}

export function progressRatioForConfiguredGoal({
  earningsRwf,
  resolved,
}: {
  earningsRwf: number;
  resolved: ResolvedDriverDailyGoal;
}) {
  if (resolved.status !== 'configured' || resolved.amountRwf <= 0) return 0;
  return earningsRwf / resolved.amountRwf;
}

export function upsertDailyGoalForEffectiveDate({
  records,
  effectiveFromLocalDate,
  amountRwf,
  now = new Date().toISOString(),
}: {
  records: DriverDailyGoalRecord[];
  effectiveFromLocalDate: string;
  amountRwf: number;
  now?: string;
}) {
  if (!isValidLocalDateString(effectiveFromLocalDate)) {
    throw new Error('Daily goal effective date must be a local YYYY-MM-DD date.');
  }
  if (!validateDailyGoalAmount(amountRwf)) {
    throw new Error(`Daily goal must be between ${MIN_DAILY_GOAL_RWF} and ${MAX_DAILY_GOAL_RWF} RWF.`);
  }

  const byDate = new Map<string, DriverDailyGoalRecord>();
  for (const record of normalizeRecords(records)) {
    byDate.set(record.effectiveFromLocalDate, record);
  }

  const existing = byDate.get(effectiveFromLocalDate);
  byDate.set(effectiveFromLocalDate, {
    amountRwf,
    effectiveFromLocalDate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  return Array.from(byDate.values())
    .sort((a, b) => a.effectiveFromLocalDate.localeCompare(b.effectiveFromLocalDate));
}
