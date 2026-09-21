import {
  MAX_SEATS_PER_BOOKING,
  bookingTotalRwf,
  buildDayOptions,
  canCancelBooking,
  clampSeatSelection,
  formatCountdown,
  formatDepartureTime,
  formatRwf,
  holdStatus,
  isActiveBooking,
  isBookable,
  isSoldOut,
  maxSeatsPerBooking,
  seatCapForTrip,
  selectableSeats,
  toKigaliDateKey,
  totalPriceRwf,
} from '../seats';

describe('intercity seat rules', () => {
  test('per-account cap works for a 4-seat cab and an 18-seat Coaster with no special case', () => {
    // floor(4/2) = 2 -> a cab never sells a whole vehicle to one account.
    expect(maxSeatsPerBooking(4)).toBe(2);
    // floor(18/2) = 9, capped at the absolute 4.
    expect(maxSeatsPerBooking(18)).toBe(4);
    expect(maxSeatsPerBooking(18)).toBe(MAX_SEATS_PER_BOOKING);
  });

  test('a one-seat vehicle still offers exactly one seat', () => {
    expect(maxSeatsPerBooking(1)).toBe(1);
    expect(maxSeatsPerBooking(2)).toBe(1);
  });

  test('nonsense capacities degrade to one seat instead of throwing', () => {
    expect(maxSeatsPerBooking(0)).toBe(1);
    expect(maxSeatsPerBooking(-5)).toBe(1);
    expect(maxSeatsPerBooking(Number.NaN)).toBe(1);
  });

  test('selectable seats are bounded by availability, not only by the cap', () => {
    expect(selectableSeats({ totalSeats: 18, remainingSeats: 2 })).toBe(2);
    expect(selectableSeats({ totalSeats: 18, remainingSeats: 12 })).toBe(4);
    expect(selectableSeats({ totalSeats: 18, remainingSeats: 0 })).toBe(0);
  });

  // The server sends `max_seats_per_booking` precisely so the stepper cannot
  // offer a number it will then refuse with SEAT_CAP_EXCEEDED.
  test('the server seat cap wins over the mirrored local rule', () => {
    expect(seatCapForTrip({ totalSeats: 18, remainingSeats: 18, maxSeatsPerBooking: 2 })).toBe(2);
    expect(selectableSeats({ totalSeats: 18, remainingSeats: 18, maxSeatsPerBooking: 2 })).toBe(2);
    expect(clampSeatSelection(4, { totalSeats: 18, remainingSeats: 18, maxSeatsPerBooking: 2 })).toBe(2);
  });

  test('a server cap above the local rule is honoured, not re-clamped to 4', () => {
    expect(selectableSeats({ totalSeats: 18, remainingSeats: 18, maxSeatsPerBooking: 6 })).toBe(6);
  });

  test('a missing or nonsense server cap falls back to the mirrored rule', () => {
    expect(seatCapForTrip({ totalSeats: 18, remainingSeats: 18 })).toBe(4);
    expect(seatCapForTrip({ totalSeats: 4, remainingSeats: 4, maxSeatsPerBooking: null })).toBe(2);
    expect(seatCapForTrip({ totalSeats: 4, remainingSeats: 4, maxSeatsPerBooking: 0 })).toBe(2);
  });

  test('clamping a selection follows availability down and never below one', () => {
    expect(clampSeatSelection(4, { totalSeats: 18, remainingSeats: 2 })).toBe(2);
    expect(clampSeatSelection(0, { totalSeats: 18, remainingSeats: 5 })).toBe(1);
    expect(clampSeatSelection(3, { totalSeats: 18, remainingSeats: 0 })).toBe(0);
  });

  test('sold out and bookability read only the remaining count and the status', () => {
    expect(isSoldOut({ remainingSeats: 0 })).toBe(true);
    expect(isSoldOut({ remainingSeats: 1 })).toBe(false);
    expect(isBookable({ status: 'OPEN', remainingSeats: 1 })).toBe(true);
    expect(isBookable({ status: 'OPEN', remainingSeats: 0 })).toBe(false);
    expect(isBookable({ status: 'BOARDING', remainingSeats: 4 })).toBe(false);
    expect(isBookable({ status: 'CANCELLED', remainingSeats: 4 })).toBe(false);
  });
});

describe('intercity money', () => {
  test('totals are integer RWF multiplications', () => {
    expect(totalPriceRwf(3, 4500)).toBe(13500);
    expect(bookingTotalRwf({ seats: 2, pricePerSeatRwf: 5000 })).toBe(10000);
  });

  test('a fractional price can never produce fractional money', () => {
    expect(totalPriceRwf(2, 1500.7)).toBe(3000);
    expect(totalPriceRwf(2.9, 1000)).toBe(2000);
  });

  test('RWF is rendered without a minor unit', () => {
    expect(formatRwf(12000)).toBe('12,000 RWF');
    expect(formatRwf(0)).toBe('0 RWF');
    expect(formatRwf(4500.9)).toBe('4,500 RWF');
    expect(formatRwf(Number.NaN)).toBe('0 RWF');
  });
});

describe('intercity hold countdown', () => {
  const expiry = '2026-09-21T10:05:00.000Z';
  const start = Date.parse('2026-09-21T10:00:00.000Z');

  test('no hold at all is its own state, not a zeroed timer', () => {
    expect(holdStatus(null, start).state).toBe('none');
    expect(holdStatus(undefined, start).state).toBe('none');
    expect(holdStatus('not-a-date', start).state).toBe('none');
  });

  test('remaining time is recomputed from the expiry instant, so a background gap is exact', () => {
    expect(holdStatus(expiry, start)).toMatchObject({ state: 'active', label: '5:00' });
    // App backgrounded for four minutes and resumed: the label is correct on
    // the first frame because nothing was being decremented.
    expect(holdStatus(expiry, start + 4 * 60 * 1000)).toMatchObject({ state: 'active', label: '1:00' });
  });

  test('expiry is a state the UI can render, not an error', () => {
    expect(holdStatus(expiry, start + 5 * 60 * 1000).state).toBe('expired');
    expect(holdStatus(expiry, start + 60 * 60 * 1000)).toMatchObject({ state: 'expired', label: '0:00' });
  });

  test('countdown formatting pads seconds', () => {
    expect(formatCountdown(59_000)).toBe('0:59');
    expect(formatCountdown(9_000)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-1)).toBe('0:00');
  });
});

describe('intercity dates', () => {
  test('a departure renders in Kigali time, not the container UTC', () => {
    // 23:30 UTC is 01:30 the next day in Kigali (UTC+2).
    expect(formatDepartureTime('2026-09-21T23:30:00.000Z')).toBe('01:30');
    expect(toKigaliDateKey(new Date('2026-09-21T23:30:00.000Z'))).toBe('2026-09-22');
  });

  test('an unparseable departure degrades instead of crashing a list row', () => {
    expect(formatDepartureTime('nonsense')).toBe('--:--');
  });

  test('the day strip covers exactly the bookable window', () => {
    const options = buildDayOptions(new Date('2026-09-21T08:00:00.000Z'));
    expect(options).toHaveLength(8);
    expect(options[0].label).toBe('Today');
    expect(options[1].label).toBe('Tomorrow');
    expect(options[0].key).toBe('2026-09-21');
    expect(options[7].key).toBe('2026-09-28');
  });
});

describe('intercity booking predicates', () => {
  test('only a live booking is surfaced on resume', () => {
    expect(isActiveBooking({ status: 'HELD' })).toBe(true);
    expect(isActiveBooking({ status: 'CONFIRMED' })).toBe(true);
    expect(isActiveBooking({ status: 'BOARDED' })).toBe(true);
    expect(isActiveBooking({ status: 'EXPIRED' })).toBe(false);
    expect(isActiveBooking({ status: 'CANCELLED' })).toBe(false);
    expect(isActiveBooking({ status: 'NO_SHOW' })).toBe(false);
  });

  test('a boarded passenger can no longer cancel their own seat', () => {
    expect(canCancelBooking({ status: 'HELD' })).toBe(true);
    expect(canCancelBooking({ status: 'CONFIRMED' })).toBe(true);
    expect(canCancelBooking({ status: 'BOARDED' })).toBe(false);
    expect(canCancelBooking({ status: 'COMPLETED' })).toBe(false);
  });
});
