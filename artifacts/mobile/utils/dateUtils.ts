export function formatDateDdMmYyyy(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDateDdMmYyyy(value: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getMaximumBirthDate(minAgeYears: number, today = new Date()): Date {
  const date = new Date(today);
  date.setFullYear(date.getFullYear() - minAgeYears);
  return date;
}

export function isAtLeastAge(value: string, minAgeYears: number, today = new Date()): boolean {
  const date = parseDateDdMmYyyy(value);
  if (!date) return false;
  return date <= getMaximumBirthDate(minAgeYears, today);
}

export function isOlderThanDays(value: string, days: number, now = new Date()): boolean {
  if (!Number.isFinite(days) || days < 0) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return now.getTime() - parsed.getTime() >= days * 24 * 60 * 60 * 1000;
}
