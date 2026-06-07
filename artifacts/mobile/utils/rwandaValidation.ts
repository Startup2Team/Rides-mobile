const RWANDA_PHONE_LOCAL_PATTERN = /^07\d{8}$/;
const RWANDA_PHONE_INTERNATIONAL_PATTERN = /^\+2507\d{8}$/;
const RWANDA_PLATE_PATTERN = /^R[A-Z]{2} \d{3} [A-Z]$/;

export const isValidRwandaNationalId = (value: string) => /^\d{16}$/.test(value);

export function normalizeRwandaPhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (RWANDA_PHONE_LOCAL_PATTERN.test(compact)) return `+250${compact.slice(1)}`;
  if (RWANDA_PHONE_INTERNATIONAL_PATTERN.test(compact)) return compact;
  return null;
}

export function formatRwandaPhoneInput(value: string): string {
  const trimmed = value.trimStart();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '').slice(0, hasLeadingPlus ? 12 : 10);
  return `${hasLeadingPlus ? '+' : ''}${digits}`;
}

/**
 * Strips +250 or 0 prefix and returns only the subscriber digits (7XXXXXXXX).
 * Used to display the editable portion after the fixed +250 prefix.
 */
export function rwandaPhoneToSubscriber(value: string): string {
  const compact = value.trim().replace(/\s/g, '');
  if (compact.startsWith('+250')) return compact.slice(4);
  if (compact.startsWith('0')) return compact.slice(1);
  return compact;
}

/**
 * Formats subscriber digits (7XXXXXXXX) as "7x xxx xxxx" for display.
 */
export function formatSubscriberDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 9);
  return [p1, p2, p3].filter(Boolean).join(' ');
}

export function formatRwandaPlateInput(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  return [compact.slice(0, 3), compact.slice(3, 6), compact.slice(6, 7)].filter(Boolean).join(' ');
}

export const normalizeRwandaPlateNumber = (value: string) =>
  value.toUpperCase().trim().replace(/\s+/g, ' ');

export const isValidRwandaPlateNumber = (value: string) =>
  RWANDA_PLATE_PATTERN.test(normalizeRwandaPlateNumber(value));
