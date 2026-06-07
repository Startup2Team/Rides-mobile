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
    nationalId: '1199080012345678',
    plateNumber: 'rad 123 a',
    momoCode: '0781234567',
    merchantCode: '  abc123  ',
  }, null),
  ...overrides,
});

describe('driver verification lifecycle', () => {
  test('submitting onboarding creates pending_review and not verified', () => {
    const application = profile({});
    expect(application.verificationStatus).toBe('pending_review');
    expect(application.isVerified).toBe(false);
    expect(application.isOnline).toBe(false);
    expect(application.plateNumber).toBe('RAD 123 A');
    expect(application.momoCode).toBe('+250781234567');
    expect(application.merchantCode).toBe('ABC123');
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

  test('rejected driver profile can carry a reviewer reason', () => {
    expect(profile({ verificationStatus: 'rejected', rejectionReason: 'National ID image is blurry.' }).rejectionReason)
      .toBe('National ID image is blurry.');
  });

  test('legacy driver-policy route cannot bypass verification', () => {
    expect(getLegacyDriverPolicyRedirect(null)).toBe('/driver-onboarding');
    expect(getLegacyDriverPolicyRedirect(profile({ verificationStatus: 'pending_review' }))).toBe('/driver-submission-confirmation');
    expect(getLegacyDriverPolicyRedirect(profile({ verificationStatus: 'approved', isVerified: true }))).toBe('/driver-submission-confirmation');
  });
});
