import type { IntercityBooking, IntercityTrip } from '@/services/intercity';

// Pure seat / money / clock rules for Rides Intercity. Everything here is a
// function of server truth plus the wall clock — no state, so a cold start or
// a force-kill replays identically from the same API payload.

/** The kigali corridor operates in RWF, an integer currency (no minor unit). */
export const INTERCITY_CURRENCY = 'RWF';

/** §3: a single account can never take more than half a vehicle, capped at 4. */
export const MAX_SEATS_PER_BOOKING = 4;

/**
 * A trip as the seat rules need it. `maxSeatsPerBooking` is the SERVER's cap
 * (`max_seats_per_booking`); it is optional here only so the pure helpers stay
 * callable with a bare {totalSeats, remainingSeats} pair.
 */
type SeatSubject = Pick<IntercityTrip, 'totalSeats' | 'remainingSeats'> &
  Partial<Pick<IntercityTrip, 'maxSeatsPerBooking'>>;

/** §4: a hold lives five minutes, then the sweeper releases the seats. */
export const HOLD_WINDOW_MS = 5 * 60 * 1000;

/**
 * Seats one account may take on this trip.
 *
 * `min(4, max(1, floor(total / 2)))` — the mirror of the server-side rule, so
 * a 4-seat cab offers 1-2 and an 18-seat Coaster offers 1-4 with no special
 * case at either end. The server remains authoritative; this only keeps the
 * stepper from offering a value that is certain to be rejected.
 */
export function maxSeatsPerBooking(totalSeats: number): number {
  if (!Number.isFinite(totalSeats) || totalSeats <= 0) return 1;
  const half = Math.floor(Math.trunc(totalSeats) / 2);
  return Math.min(MAX_SEATS_PER_BOOKING, Math.max(1, half));
}

/**
 * The cap the stepper must obey: the SERVER's `max_seats_per_booking` whenever
 * the trip carries one, and the mirrored local rule only as a fallback. The
 * server sends this number precisely so the UI cannot offer a seat count it
 * will then refuse with SEAT_CAP_EXCEEDED.
 */
export function seatCapForTrip(trip: SeatSubject): number {
  const serverCap = trip.maxSeatsPerBooking;
  // Taken verbatim, not re-clamped to MAX_SEATS_PER_BOOKING: the server owns
  // this rule, and a client ceiling would silently under-offer the day the
  // server raises it.
  if (typeof serverCap === 'number' && Number.isFinite(serverCap) && serverCap > 0) {
    return Math.trunc(serverCap);
  }
  return maxSeatsPerBooking(trip.totalSeats);
}

/** Seats actually selectable right now: bounded by the per-account cap AND availability. */
export function selectableSeats(trip: SeatSubject): number {
  return Math.max(0, Math.min(seatCapForTrip(trip), Math.trunc(trip.remainingSeats)));
}

export function isSoldOut(trip: Pick<IntercityTrip, 'remainingSeats'>): boolean {
  return Math.trunc(trip.remainingSeats) <= 0;
}

/**
 * Can this trip still be booked from a browsing list?
 *
 * Advisory only — the render is always a snapshot and the hold call is the
 * authority (it answers 409 SEATS_UNAVAILABLE when the seats went away
 * between render and tap).
 */
export function isBookable(trip: Pick<IntercityTrip, 'status' | 'remainingSeats'>): boolean {
  return trip.status === 'OPEN' && !isSoldOut(trip);
}

export function clampSeatSelection(requested: number, trip: SeatSubject): number {
  const ceiling = selectableSeats(trip);
  if (ceiling <= 0) return 0;
  if (!Number.isFinite(requested)) return 1;
  return Math.min(ceiling, Math.max(1, Math.trunc(requested)));
}

/** Integer RWF only. Multiplying two integers keeps it exact — no float money. */
export function totalPriceRwf(seats: number, pricePerSeatRwf: number): number {
  return Math.max(0, Math.trunc(seats)) * Math.max(0, Math.trunc(pricePerSeatRwf));
}

/**
 * The booking's total in RWF.
 *
 * Prefers the server's own `totalRwf`: money has ONE source of truth, and it is
 * not the client. Falls back to seats x price only when the server did not send
 * it, so an older payload still renders rather than showing nothing.
 */
export function bookingTotalRwf(
  booking: Pick<IntercityBooking, 'seats' | 'pricePerSeatRwf'> & { totalRwf?: number | null },
): number {
  if (typeof booking.totalRwf === 'number' && Number.isFinite(booking.totalRwf)) {
    return Math.max(0, Math.trunc(booking.totalRwf));
  }
  return totalPriceRwf(booking.seats, booking.pricePerSeatRwf);
}

/**
 * `12,000 RWF`. RWF has no minor unit, so the fraction digits are pinned to
 * zero — a "12,000.00 RWF" price would read as a different currency.
 */
export function formatRwf(amountRwf: number): string {
  const value = Math.trunc(Number.isFinite(amountRwf) ? amountRwf : 0);
  try {
    const formatted = new Intl.NumberFormat('en-RW', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(value);
    return `${formatted} ${INTERCITY_CURRENCY}`;
  } catch {
    return `${value} ${INTERCITY_CURRENCY}`;
  }
}

/** `06:30` in Kigali time — the departure is a promise (§11 D2), so show it exactly. */
export function formatDepartureTime(departAtIso: string): string {
  const date = new Date(departAtIso);
  if (Number.isNaN(date.getTime())) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Kigali',
    }).format(date);
  } catch {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}

export function formatDepartureDate(departAtIso: string): string {
  const date = new Date(departAtIso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Africa/Kigali',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** `YYYY-MM-DD` in Kigali time — the `?date=` filter is a Kigali calendar day. */
export function toKigaliDateKey(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Africa/Kigali',
    }).format(date);
    // en-CA already renders YYYY-MM-DD.
    return parts;
  } catch {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export interface DayOption {
  /** `YYYY-MM-DD` Kigali calendar day — the value sent as `?date=`. */
  key: string;
  /** `Today` / `Tomorrow` / `Fri 26`. */
  label: string;
  date: Date;
}

/**
 * The bookable window is NOW .. NOW + 7 days (§1 out-of-scope: dates beyond
 * +7). Offering exactly those eight days removes the whole class of "picked a
 * date the server will refuse".
 */
export function buildDayOptions(now: Date = new Date(), days = 8): DayOption[] {
  const options: DayOption[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const label =
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Tomorrow'
          : formatDepartureDate(date.toISOString());
    options.push({ key: toKigaliDateKey(date), label, date });
  }
  return options;
}

/* ------------------------------------------------------------------ */
/* Hold countdown                                                      */
/* ------------------------------------------------------------------ */

export type HoldState = 'none' | 'active' | 'expired';

export interface HoldStatus {
  state: HoldState;
  remainingMs: number;
  /** `4:59` — mm:ss, always recomputed from the expiry instant. */
  label: string;
}

/**
 * Derived from `hold_expires_at` and the wall clock on EVERY tick, never
 * decremented from a counter: a hold that started before the app was
 * backgrounded shows the correct remaining time the instant it resumes, and a
 * force-kill loses nothing (the booking row is server truth).
 */
export function holdStatus(holdExpiresAt: string | null | undefined, now: number = Date.now()): HoldStatus {
  if (!holdExpiresAt) return { state: 'none', remainingMs: 0, label: '0:00' };
  const expiry = new Date(holdExpiresAt).getTime();
  if (Number.isNaN(expiry)) return { state: 'none', remainingMs: 0, label: '0:00' };
  const remainingMs = expiry - now;
  if (remainingMs <= 0) return { state: 'expired', remainingMs: 0, label: '0:00' };
  return { state: 'active', remainingMs, label: formatCountdown(remainingMs) };
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Status copy                                                         */
/* ------------------------------------------------------------------ */

export function bookingStatusLabel(status: IntercityBooking['status']): string {
  switch (status) {
    case 'HELD':
      return 'Seats held';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'BOARDED':
      return 'On board';
    case 'COMPLETED':
      return 'Completed';
    case 'EXPIRED':
      return 'Hold expired';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'Marked no-show';
    default:
      return status;
  }
}

export function tripStatusLabel(status: IntercityTrip['status']): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'BOARDING':
      return 'Boarding';
    case 'IN_TRANSIT':
      return 'On the road';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

/** A booking the passenger can still act on — used to surface it on resume. */
export function isActiveBooking(booking: Pick<IntercityBooking, 'status'>): boolean {
  return booking.status === 'HELD' || booking.status === 'CONFIRMED' || booking.status === 'BOARDED';
}

/** A passenger may only cancel while the seat is still theirs to give back. */
export function canCancelBooking(booking: Pick<IntercityBooking, 'status'>): boolean {
  return booking.status === 'HELD' || booking.status === 'CONFIRMED';
}
