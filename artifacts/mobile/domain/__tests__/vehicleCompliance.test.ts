import {
  getAuthorizationComplianceStatus,
  getInsuranceComplianceStatus,
  getLicenseComplianceStatus,
} from '../vehicleCompliance';

describe('vehicle compliance helpers', () => {
  const now = new Date('2026-06-18T12:00:00.000Z');

  test('returns valid for a far future expiry', () => {
    expect(getLicenseComplianceStatus('01/01/2030', now)).toBe('valid');
  });

  test('returns expiring_soon for a 30 day expiry window', () => {
    expect(getLicenseComplianceStatus('18/07/2026', now)).toBe('expiring_soon');
    expect(getInsuranceComplianceStatus('18/07/2026', now)).toBe('expiring_soon');
  });

  test('returns urgent for a 7 day expiry window', () => {
    expect(getLicenseComplianceStatus('25/06/2026', now)).toBe('urgent');
    expect(getAuthorizationComplianceStatus('25/06/2026', now)).toBe('urgent');
  });

  test('returns expired for a past expiry date', () => {
    expect(getLicenseComplianceStatus('17/06/2026', now)).toBe('expired');
    expect(getInsuranceComplianceStatus('17/06/2026', now)).toBe('expired');
  });

  test('treats missing or invalid expiry dates as valid', () => {
    expect(getLicenseComplianceStatus(undefined, now)).toBe('valid');
    expect(getInsuranceComplianceStatus('not-a-date', now)).toBe('valid');
  });
});
