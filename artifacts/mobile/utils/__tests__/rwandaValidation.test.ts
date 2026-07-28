import {
  formatRwandaPlateInput,
  isValidRwandaNationalId,
  isValidRwandaPlateNumber,
  normalizeRwandaPhoneNumber,
} from '../rwandaValidation';

describe('Rwanda phone validation', () => {
  test.each([
    ['0781234567', '+250781234567'],
    ['+250781234567', '+250781234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeRwandaPhoneNumber(input)).toBe(expected);
  });

  test.each(['781234567', '250781234567', '+250681234567', '078123456'])('rejects %s', input => {
    expect(normalizeRwandaPhoneNumber(input)).toBeNull();
  });
});

describe('Rwanda identity and plate validation', () => {
  test('requires exactly 16 numeric National ID digits', () => {
    expect(isValidRwandaNationalId('1234567890123456')).toBe(true);
    expect(isValidRwandaNationalId('123456789012345')).toBe(false);
    expect(isValidRwandaNationalId('123456789012345A')).toBe(false);
  });

  test('formats and validates Rwanda plates', () => {
    expect(formatRwandaPlateInput(' rad 123 a ')).toBe('RAD 123 A');
    expect(formatRwandaPlateInput('RAD852B')).toBe('RAD 852 B');
    // Spaces are preserved while typing (the field must allow them) ...
    expect(formatRwandaPlateInput('RAD ')).toBe('RAD ');
    expect(formatRwandaPlateInput('RAD 12')).toBe('RAD 12');
    // ... but non-plate punctuation (dashes etc.) is stripped, uppercased.
    expect(formatRwandaPlateInput('AB-123-XY')).toBe('AB123XY');
    expect(isValidRwandaPlateNumber('RAD 123 A')).toBe(true);
    expect(isValidRwandaPlateNumber('ABC 123 A')).toBe(false);
  });
});
