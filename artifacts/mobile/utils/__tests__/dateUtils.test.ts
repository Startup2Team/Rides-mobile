import { getMaximumBirthDate, isAtLeastAge, parseDateDdMmYyyy } from '../dateUtils';

describe('date utils', () => {
  test('computes the maximum birth date for a minimum age', () => {
    const maxBirthDate = getMaximumBirthDate(18, new Date(2026, 5, 7));
    expect(maxBirthDate.getFullYear()).toBe(2008);
    expect(maxBirthDate.getMonth()).toBe(5);
    expect(maxBirthDate.getDate()).toBe(7);
  });

  test('treats applicants as eligible only when they are at least the requested age', () => {
    const today = new Date(2026, 5, 7);
    expect(isAtLeastAge('07/06/2008', 18, today)).toBe(true);
    expect(isAtLeastAge('08/06/2008', 18, today)).toBe(false);
    expect(isAtLeastAge('bad date', 18, today)).toBe(false);
  });

  test('parses DD/MM/YYYY dates safely', () => {
    const parsed = parseDateDdMmYyyy('07/06/2026');
    expect(parsed?.getFullYear()).toBe(2026);
  });
});
