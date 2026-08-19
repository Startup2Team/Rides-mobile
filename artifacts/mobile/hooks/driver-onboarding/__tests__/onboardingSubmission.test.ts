import { INITIAL_DRIVER_ONBOARDING_FORM } from '../onboardingTypes';
import { buildDraftDriverProfile, buildPendingDriverProfile, formFromDriverProfile } from '../onboardingSubmission';

describe('buildPendingDriverProfile', () => {
  test('carries the national ID country and gender onto the saved profile', () => {
    const profile = buildPendingDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      nationalId: '1990010112345678',
      nationalIdCountry: 'RW',
      gender: 'female',
      licenseNumber: '1234567890123456',
      momoCode: '0788000000',
    }, null);

    expect(profile.nationalIdCountry).toBe('RW');
    expect(profile.gender).toBe('female');
  });

  test('omits national ID country and gender when not chosen', () => {
    const profile = buildPendingDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      nationalId: '1990010112345678',
      licenseNumber: '1234567890123456',
      momoCode: '0788000000',
    }, null);

    expect(profile.nationalIdCountry).toBeUndefined();
    expect(profile.gender).toBeUndefined();
  });
});

describe('formFromDriverProfile', () => {
  // Regression: this used to hardcode gender to '' regardless of what the
  // driver had actually picked, so every resume (rejected/draft) or resubmit
  // silently lost it even though it had been saved on the profile.
  test('reads gender back from the profile instead of resetting it', () => {
    const profile = buildPendingDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      nationalId: '1990010112345678',
      nationalIdCountry: 'RW',
      gender: 'other',
      licenseNumber: '1234567890123456',
      momoCode: '0788000000',
    }, null);

    const form = formFromDriverProfile(profile);

    expect(form.gender).toBe('other');
    expect(form.nationalIdCountry).toBe('RW');
  });

  test('falls back to an empty (unselected) gender and country for profiles saved before this field existed', () => {
    const profile = buildPendingDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      nationalId: '1990010112345678',
      licenseNumber: '1234567890123456',
      momoCode: '0788000000',
    }, null);

    const form = formFromDriverProfile(profile);

    expect(form.gender).toBe('');
    expect(form.nationalIdCountry).toBe('');
  });
});

describe('buildDraftDriverProfile', () => {
  test('keeps the national ID country and gender when saving a draft', () => {
    const draft = buildDraftDriverProfile({
      ...INITIAL_DRIVER_ONBOARDING_FORM,
      nationalId: '1990010112345678',
      nationalIdCountry: 'UG',
      gender: 'male',
      licenseNumber: '1234567890123456',
      momoCode: '0788000000',
    }, null);

    expect(draft.verificationStatus).toBe('draft');
    expect(draft.nationalIdCountry).toBe('UG');
    expect(draft.gender).toBe('male');
  });
});
