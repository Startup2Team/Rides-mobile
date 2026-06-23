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
 * Returns subscriber digits (7XXXXXXXX) in a compact form for display.
 */
export function formatSubscriberDigits(digits: string): string {
  return digits.replace(/\D/g, '').slice(0, 9);
}

export function formatRwandaPlateInput(value: string): string {
  const upper = value.toUpperCase().trim();
  const compact = upper.replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (/^R[A-Z]{2}\d{3}[A-Z]$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3, 6)} ${compact.slice(6, 7)}`;
  }
  return upper.replace(/\s+/g, ' ').trim();
}

export const normalizeRwandaPlateNumber = (value: string) =>
  formatRwandaPlateInput(value);

export const isValidRwandaPlateNumber = (value: string) =>
  RWANDA_PLATE_PATTERN.test(normalizeRwandaPlateNumber(value));
