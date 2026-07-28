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
  // Uppercase and keep letters, digits AND spaces so the plate can be typed
  // naturally — Rwandan plates are spaced (e.g. "RAD 123 A"). Collapse repeated
  // spaces and drop a leading one, but KEEP a trailing space the user is typing
  // (the old `.trim()` deleted it every keystroke, so spaces "didn't work").
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '');
  // Auto-format the standard private/commercial pattern (RAD000A → RAD 000 A).
  const compact = cleaned.replace(/\s/g, '');
  if (/^R[A-Z]{2}\d{3}[A-Z]$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3, 6)} ${compact.slice(6, 7)}`;
  }
  // Otherwise keep exactly what the user typed (with their spaces) — never strip.
  return cleaned;
}

export const normalizeRwandaPlateNumber = (value: string) =>
  formatRwandaPlateInput(value);

export const isValidRwandaPlateNumber = (value: string) =>
  RWANDA_PLATE_PATTERN.test(normalizeRwandaPlateNumber(value));
