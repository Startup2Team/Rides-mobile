import { parseDateDdMmYyyy } from '@/utils/dateUtils';

export type VehicleComplianceStatus = 'valid' | 'expiring_soon' | 'urgent' | 'expired';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Current launch policy:
 * - Driver license expiry is enforced before going online.
 * - Insurance expiry is warning-only.
 * - Authorization expiry is warning-only.
 *
 * Future policy:
 * - Insurance and authorization may become enforced later without changing the data model.
 */

function parseFlexibleDate(value?: string | null) {
  if (!value) return null;
  const parsedDdMmYyyy = parseDateDdMmYyyy(value);
  if (parsedDdMmYyyy) return parsedDdMmYyyy;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDaysRemaining(daysRemaining: number) {
  if (daysRemaining <= 0) return 'today';
  return daysRemaining === 1 ? 'in 1 day' : `in ${daysRemaining} days`;
}

function getComplianceStatus(expiryDate?: string | null, now = new Date()): VehicleComplianceStatus {
  const expiry = parseFlexibleDate(expiryDate);
  if (!expiry) return 'valid';

  const normalizedExpiry = toDateOnly(expiry).getTime();
  const normalizedNow = toDateOnly(now).getTime();
  const dayDifference = Math.floor((normalizedExpiry - normalizedNow) / DAY_MS);

  if (dayDifference < 0) return 'expired';
  if (dayDifference <= 7) return 'urgent';
  if (dayDifference <= 30) return 'expiring_soon';
  return 'valid';
}

function getDaysRemaining(expiryDate?: string | null, now = new Date()) {
  const expiry = parseFlexibleDate(expiryDate);
  if (!expiry) return null;
  const normalizedExpiry = toDateOnly(expiry).getTime();
  const normalizedNow = toDateOnly(now).getTime();
  return Math.floor((normalizedExpiry - normalizedNow) / DAY_MS);
}

function buildWarningMessage(
  label: string,
  expiryDate?: string | null,
  now = new Date(),
  warningOnly = false,
) {
  const status = getComplianceStatus(expiryDate, now);
  if (status === 'valid') return null;

  const daysRemaining = getDaysRemaining(expiryDate, now);
  const daysText = daysRemaining == null ? null : formatDaysRemaining(daysRemaining);

  if (status === 'expired') {
    return warningOnly
      ? `⚠ ${label} expired. Update recommended.`
      : `❌ ${label} expired`;
  }

  if (daysText) {
    return `⚠ ${label} expires ${daysText}`;
  }

  return `⚠ ${label} expires soon`;
}

export function getLicenseComplianceStatus(expiryDate?: string | null, now = new Date()) {
  return getComplianceStatus(expiryDate, now);
}

export function getInsuranceComplianceStatus(expiryDate?: string | null, now = new Date()) {
  return getComplianceStatus(expiryDate, now);
}

export function getAuthorizationComplianceStatus(expiryDate?: string | null, now = new Date()) {
  return getComplianceStatus(expiryDate, now);
}

export function getLicenseComplianceMessage(expiryDate?: string | null, now = new Date()) {
  return buildWarningMessage('Driver license', expiryDate, now, false);
}

export function getInsuranceComplianceMessage(expiryDate?: string | null, now = new Date()) {
  return buildWarningMessage('Insurance', expiryDate, now, true);
}

export function getAuthorizationComplianceMessage(expiryDate?: string | null, now = new Date()) {
  return buildWarningMessage('Authorization', expiryDate, now, true);
}

export function getComplianceStatusLabel(status: VehicleComplianceStatus) {
  return status === 'valid'
    ? 'Valid'
    : status === 'expiring_soon'
      ? 'Expiring Soon'
      : status === 'urgent'
        ? 'Urgent'
        : 'Expired';
}

