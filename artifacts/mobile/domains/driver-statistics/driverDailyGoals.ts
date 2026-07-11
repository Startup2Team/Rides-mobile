export interface DriverDailyGoalRecord {
  amountRwf: number;
  effectiveFromLocalDate: string;
  createdAt: string;
  updatedAt: string;
}

export const DAILY_GOAL_STEP_RWF = 1_000;
export const MIN_DAILY_GOAL_RWF = 500;
export const MAX_DAILY_GOAL_RWF = 1_000_000;
export const DEFAULT_DAILY_GOAL_RWF = 30_000;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function toLocalDateString(date: Date) {
  return [
    date.getFullYear(),
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
  return typeof value === 'string' && LOCAL_DATE_PATTERN.test(value);
}

export function validateDailyGoalAmount(amountRwf: unknown): amountRwf is number {
  return typeof amountRwf === 'number'
    && Number.isInteger(amountRwf)
    && amountRwf >= MIN_DAILY_GOAL_RWF
    && amountRwf <= MAX_DAILY_GOAL_RWF;
}

function normalizeRecords(records: DriverDailyGoalRecord[]) {
  return records
    .filter(record =>
      validateDailyGoalAmount(record.amountRwf)
      && isValidLocalDateString(record.effectiveFromLocalDate)
      && typeof record.createdAt === 'string'
      && typeof record.updatedAt === 'string',
    )
    .sort((a, b) => a.effectiveFromLocalDate.localeCompare(b.effectiveFromLocalDate));
}

export function resolveDailyGoalForDate({
  records,
  selectedLocalDate,
  fallbackGoal = DEFAULT_DAILY_GOAL_RWF,
}: {
  records: DriverDailyGoalRecord[];
  selectedLocalDate: string;
  fallbackGoal?: number;
}) {
  const fallback = validateDailyGoalAmount(fallbackGoal) ? fallbackGoal : DEFAULT_DAILY_GOAL_RWF;
  if (!isValidLocalDateString(selectedLocalDate)) return fallback;

  const resolved = normalizeRecords(records)
    .filter(record => record.effectiveFromLocalDate <= selectedLocalDate)
    .at(-1);

  return resolved?.amountRwf ?? fallback;
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
