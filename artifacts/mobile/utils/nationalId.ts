// Country-aware national ID format helpers for driver onboarding
// (FEAT-onboarding-fields). Mirrors the backend's single authoritative source
// — Rides-api `pkg/nationalid` — so the client rejects/accepts the exact same
// shapes the server will. Keep these patterns in sync with that package.
export type NationalIdCountry = 'RW' | 'UG';

const NATIONAL_ID_PATTERNS: Record<NationalIdCountry, RegExp> = {
  RW: /^\d{16}$/,
  UG: /^[A-Z0-9]{14}$/,
};

export function isValidNationalId(country: NationalIdCountry | '', value: string): boolean {
  if (!country) return false;
  return NATIONAL_ID_PATTERNS[country].test(value);
}

// Constrains keystrokes to what the selected country's format can ever accept.
// RW is digits-only (16); UG is alphanumeric (14) — critically, UG must NOT
// strip letters the way the old RW-only mask did.
export function formatNationalIdInput(country: NationalIdCountry | '', value: string): string {
  if (country === 'UG') return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 14);
  return value.replace(/\D/g, '').slice(0, 16);
}
