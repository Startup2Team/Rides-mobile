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
  const validStepZeroForm = {
    ...INITIAL_DRIVER_ONBOARDING_FORM,
    brand: 'Toyota',
    model: 'Corolla',
    manufactureYear: '2020',
    dob: '31/12/2099',
    nationalId: '1990010112345678',
    province: 'City of Kigali',
    district: 'Gasabo',
    sector: 'Kacyiru',
    cell: 'Cell A',
    village: 'Village B',
  };

  const validateStep = (step: number, overrides = {}) => useDriverOnboardingValidation({
    acceptedTerms: true,
    docs: INITIAL_DRIVER_DOCUMENTS,
    form: INITIAL_DRIVER_ONBOARDING_FORM,
    vehiclePhotos: { outside: null, inside: null },
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
    expect(validateStep(1, { form: { ...INITIAL_DRIVER_ONBOARDING_FORM, brand: 'Toyota', model: 'Corolla', manufactureYear: '2020', plateNumber: 'ABC 123 A', licenseNumber: '1234567890123456' } }).plateNumber)
      .toBe('Enter a valid Rwanda plate in the format RAD 000 A');
  });

  test('requires vehicle brand, model, and manufacture year', () => {
    const errors = validateStep(1, {
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        plateNumber: 'RAC 002 A',
        licenseNumber: '1234567890123456',
      },
    });

    expect(errors.brand).toBe('Required');
    expect(errors.model).toBe('Required');
    expect(errors.manufactureYear).toBe('Required');
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
        brand: 'Toyota',
        model: 'Corolla',
        manufactureYear: '2020',
        licenseExpiryDate: futureDate,
        insuranceExpiryDate: futureDate,
        authorizationExpiryDate: futureDate,
      },
    });

    expect(errors.insurance).toBeUndefined();
    expect(errors.authorization).toBeUndefined();
  });

  test('requires vehicle photos by vehicle type', () => {
    const errors = validateStep(2, {
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        vehicleType: 'cab',
        brand: 'Toyota',
        model: 'Corolla',
        manufactureYear: '2020',
        licenseExpiryDate: '08/06/2030',
        insuranceExpiryDate: '08/06/2030',
        authorizationExpiryDate: '08/06/2030',
      },
      vehiclePhotos: {
        outside: null,
        inside: null,
      },
    });

    expect(errors.vehicleOutsidePhoto).toBe('Vehicle outside photo is required');
    expect(errors.vehicleInsidePhoto).toBe('Vehicle inside photo is required');

    const hiluxErrors = validateStep(2, {
      form: {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        vehicleType: 'hilux',
        brand: 'Toyota',
        model: 'Hilux',
        manufactureYear: '2020',
        licenseExpiryDate: '08/06/2030',
        insuranceExpiryDate: '08/06/2030',
        authorizationExpiryDate: '08/06/2030',
      },
      vehiclePhotos: {
        outside: null,
        inside: null,
      },
    });

    expect(hiluxErrors.vehicleOutsidePhoto).toBe('Vehicle outside photo is required');
    expect(hiluxErrors.vehicleInsidePhoto).toBeUndefined();
  });

  test('blocks invalid MoMo numbers', () => {
    expect(validateStep(3, { form: { ...INITIAL_DRIVER_ONBOARDING_FORM, momoCode: '250781234567' } }).momoCode)
      .toBe('Enter 07XXXXXXXX or +2507XXXXXXXX');
  });

  test('blocks applicants younger than 18', () => {
    expect(useDriverOnboardingValidation({
      acceptedTerms: true,
      docs: INITIAL_DRIVER_DOCUMENTS,
      form: validStepZeroForm,
      vehiclePhotos: { outside: null, inside: null },
      selfieUri: 'file:///selfie.jpg',
      step: 0,
    })()).toMatchObject({
      dob: 'Driver applicants must be at least 18 years old',
    });
  });
});
