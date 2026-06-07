import { INITIAL_DRIVER_ONBOARDING_FORM } from '../onboardingTypes';
import { buildPendingDriverProfile } from '../onboardingSubmission';
import {
  canAccessDriverMode,
  canDriverGoOnline,
  getDriverApplicationAction,
  getLegacyDriverPolicyRedirect,
  isProtectedDriverPath,
} from '@/utils/driverVerification';
import type { DriverProfile } from '@/types';

const profile = (overrides: Partial<DriverProfile>): DriverProfile => ({
  ...buildPendingDriverProfile({
    ...INITIAL_DRIVER_ONBOARDING_FORM,
    licenseNumber: '1234567890123456',
  }, null),
  ...overrides,
});

describe('driver verification lifecycle', () => {
  test('submitting onboarding creates pending_review and not verified', () => {
    const application = profile({});
    expect(application.verificationStatus).toBe('pending_review');
    expect(application.isVerified).toBe(false);
    expect(application.isOnline).toBe(false);
  });

  test('pending_review cannot access driver mode', () => {
    expect(canAccessDriverMode(profile({ verificationStatus: 'pending_review', isVerified: false }))).toBe(false);
    expect(canDriverGoOnline(profile({ verificationStatus: 'pending_review', isVerified: false }))).toBe(false);
    expect(isProtectedDriverPath('/(driver)')).toBe(true);
    expect(isProtectedDriverPath('/driver-negotiation')).toBe(true);
  });

  test('approved and verified driver can access driver mode', () => {
    expect(canAccessDriverMode(profile({ verificationStatus: 'approved', isVerified: true }))).toBe(true);
    expect(canDriverGoOnline(profile({ verificationStatus: 'approved', isVerified: true }))).toBe(true);
  });

  test('rejected driver can update and resubmit', () => {
    expect(getDriverApplicationAction(profile({ verificationStatus: 'rejected' }))).toEqual({
      label: 'Update application',
      route: '/driver-onboarding',
    });
  });

  test('legacy driver-policy route cannot bypass verification', () => {
    expect(getLegacyDriverPolicyRedirect(null)).toBe('/driver-onboarding');
    expect(getLegacyDriverPolicyRedirect(profile({ verificationStatus: 'pending_review' }))).toBe('/driver-application-status');
    expect(getLegacyDriverPolicyRedirect(profile({ verificationStatus: 'approved', isVerified: true }))).toBe('/driver-application-status');
  });
});
