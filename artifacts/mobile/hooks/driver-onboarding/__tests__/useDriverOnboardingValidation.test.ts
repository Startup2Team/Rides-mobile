import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM } from '../onboardingTypes';
import { isFutureExpiryDate, isValidDriverLicenceNumber, useDriverOnboardingValidation } from '../useDriverOnboardingValidation';

describe('driver licence number validation', () => {
  test('accepts exactly 16 digits', () => {
    expect(isValidDriverLicenceNumber('1234567890123456')).toBe(true);
  });

  test.each([
    '',
    '123456789012345',
    '12345678901234567',
    '123456789012345A',
    '1234 5678 9012 3456',
  ])('rejects invalid licence number %p', licenceNumber => {
    expect(isValidDriverLicenceNumber(licenceNumber)).toBe(false);
  });
});

describe('document expiry date validation', () => {
  const today = new Date(2026, 5, 7);

  test('accepts dates after today', () => {
    expect(isFutureExpiryDate('08/06/2026', today)).toBe(true);
  });

  test.each(['', '07/06/2026', '06/06/2026', '31/02/2027'])('rejects invalid or non-future expiry date %p', value => {
    expect(isFutureExpiryDate(value, today)).toBe(false);
  });
});

describe('driver onboarding blocking validation', () => {
  const validateStep = (step: number, overrides = {}) => useDriverOnboardingValidation({
    acceptedTerms: true,
    docs: INITIAL_DRIVER_DOCUMENTS,
    form: INITIAL_DRIVER_ONBOARDING_FORM,
    selfieUri: 'file:///selfie.jpg',
    step,
    ...overrides,
  })();

  test('requires a valid 16-digit National ID', () => {
    expect(validateStep(0).nationalId).toBe('Required');
    expect(validateStep(0, { form: { ...INITIAL_DRIVER_ONBOARDING_FORM, nationalId: '1234' } }).nationalId)
      .toBe('National ID must be exactly 16 digits');
  });

  test('blocks an invalid Rwanda plate', () => {
    expect(validateStep(1, { form: { ...INITIAL_DRIVER_ONBOARDING_FORM, plateNumber: 'ABC 123 A', licenseNumber: '1234567890123456' } }).plateNumber)
      .toBe('Enter a valid Rwanda plate in the format RAD 000 A');
  });

  test('requires licence and National ID front and back images', () => {
    const errors = validateStep(2, {
      docs: {
        ...INITIAL_DRIVER_DOCUMENTS,
        license: ['file:///licence-front.jpg', null],
        nationalId: ['file:///id-front.jpg', null],
      },
    });
    expect(errors.license).toBe("Driver's licence back image is required");
    expect(errors.nationalId).toBe('National ID back image is required');
  });

  test('accepts front-only insurance and authorization documents', () => {
    const futureDate = '08/06/2030';
    const errors = validateStep(2, {
      docs: {
        ...INITIAL_DRIVER_DOCUMENTS,
        license: ['file:///licence-front.jpg', 'file:///licence-back.jpg'],
        nationalId: ['file:///id-front.jpg', 'file:///id-back.jpg'],
        insurance: ['file:///insurance.jpg', null],
        authorization: ['file:///rura-authorization.jpg', null],
      },
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        licenseExpiryDate: futureDate,
        insuranceExpiryDate: futureDate,
        authorizationExpiryDate: futureDate,
      },
    });

    expect(errors.insurance).toBeUndefined();
    expect(errors.authorization).toBeUndefined();
  });

  test('blocks invalid MoMo numbers', () => {
    expect(validateStep(3, { form: { ...INITIAL_DRIVER_ONBOARDING_FORM, momoCode: '250781234567' } }).momoCode)
      .toBe('Enter 07XXXXXXXX or +2507XXXXXXXX');
  });
});
