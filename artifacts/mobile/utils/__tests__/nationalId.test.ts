import { formatNationalIdInput, isValidNationalId } from '../nationalId';

describe('isValidNationalId', () => {
  test('accepts a 16-digit Rwandan ID', () => {
    expect(isValidNationalId('RW', '1199080012345678')).toBe(true);
  });

  test.each(['', '123456789012345', '12345678901234567', '119908001234567A'])(
    'rejects an invalid Rwandan ID %p',
    value => {
      expect(isValidNationalId('RW', value)).toBe(false);
    },
  );

  test('accepts a 14-character Ugandan NIN (letters and digits)', () => {
    expect(isValidNationalId('UG', 'CM12345678901A')).toBe(true);
  });

  test.each(['', 'CM1234567890', 'cm12345678901a', 'CM12345678901AB'])(
    'rejects an invalid Ugandan NIN %p',
    value => {
      expect(isValidNationalId('UG', value)).toBe(false);
    },
  );

  test('rejects when no country is selected', () => {
    expect(isValidNationalId('', '1199080012345678')).toBe(false);
  });
});

describe('formatNationalIdInput', () => {
  test('RW strips everything but digits and caps at 16', () => {
    expect(formatNationalIdInput('RW', '1199-0800 1234a5678999')).toBe('1199080012345678');
    expect(formatNationalIdInput('RW', '1199-0800 1234a5678999').length).toBeLessThanOrEqual(16);
  });

  test('UG keeps letters, uppercases, and caps at 14 — never strips letters', () => {
    expect(formatNationalIdInput('UG', 'cm1234 5678-901a')).toBe('CM12345678901A');
  });

  test('an empty country falls back to the RW (digits-only) mask', () => {
    expect(formatNationalIdInput('', 'ab12cd34')).toBe('1234');
  });
});
