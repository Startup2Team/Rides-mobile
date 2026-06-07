import { isFutureExpiryDate, isValidDriverLicenceNumber } from '../useDriverOnboardingValidation';

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
