import {
  loadStoredDriverOnboardingDraft,
  removeStoredDriverOnboardingDraft,
  saveStoredDriverOnboardingDraft,
} from '../driverOnboardingPersistence';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM } from '@/hooks/driver-onboarding/onboardingTypes';
import { driverOnboardingDraftSchema } from '../storageSchemas';

// FEAT-onboarding-fields: nationalIdCountry was added to the persisted draft.
// A force-kill mid-onboarding must still resume correctly for (a) a draft
// written by an OLDER app version that never had this field, and (b) a fresh
// draft written by this version. Neither should nuke the saved progress —
// see the STORAGE_VERSION note: this is deliberately additive/optional
// instead of a version bump, which would invalidate every other persisted
// domain in the app on next launch.

describe('driver onboarding draft — national ID country persistence', () => {
  afterEach(async () => {
    await removeStoredDriverOnboardingDraft();
  });

  test('a draft saved with a chosen country round-trips through storage', async () => {
    await saveStoredDriverOnboardingDraft({
      form: { ...INITIAL_DRIVER_ONBOARDING_FORM, nationalIdCountry: 'UG', nationalId: 'CM12345678901A' },
      docs: INITIAL_DRIVER_DOCUMENTS,
      vehiclePhotos: { outside: null, inside: null },
      selfieUri: null,
      acceptedTerms: false,
      step: 0,
      updatedAt: '2026-08-19T00:00:00.000Z',
    });

    const result = await loadStoredDriverOnboardingDraft();

    expect(result.source).toBe('current');
    expect(result.data?.form.nationalIdCountry).toBe('UG');
  });

  test('a pre-existing draft shape missing nationalIdCountry still parses (force-kill/resume from an older app version)', () => {
    const { nationalIdCountry: _omit, ...legacyForm } = INITIAL_DRIVER_ONBOARDING_FORM;
    const legacyDraft = {
      form: legacyForm,
      docs: INITIAL_DRIVER_DOCUMENTS,
      vehiclePhotos: { outside: null, inside: null },
      selfieUri: null,
      acceptedTerms: false,
      step: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const parsed = driverOnboardingDraftSchema.safeParse(legacyDraft);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.form.nationalIdCountry).toBe('');
      expect(parsed.data.step).toBe(2);
    }
  });
});
