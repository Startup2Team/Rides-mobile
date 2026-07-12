import {
  consumeDriverEarningsDateSelection,
  getDriverEarningsDateSelectionVersion,
  publishDriverEarningsDateSelection,
} from '../driverEarningsDateSelectionSignal';

describe('driverEarningsDateSelectionSignal', () => {
  test('publishes a one-time selection that can be consumed once', () => {
    const before = getDriverEarningsDateSelectionVersion();
    const published = publishDriverEarningsDateSelection('2026-06-15');
    expect(published).toBe(before + 1);

    const first = consumeDriverEarningsDateSelection(before);
    expect(first).toEqual({ version: published, localDate: '2026-06-15' });

    const second = consumeDriverEarningsDateSelection(published);
    expect(second).toEqual({ version: published, localDate: null });
  });

  test('keeps the latest pending date when published multiple times', () => {
    const before = getDriverEarningsDateSelectionVersion();
    publishDriverEarningsDateSelection('2026-01-01');
    const latest = publishDriverEarningsDateSelection('1500-01-10');
    const consumed = consumeDriverEarningsDateSelection(before);
    expect(consumed).toEqual({ version: latest, localDate: '1500-01-10' });
  });
});
