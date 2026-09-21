import {
  BackendError,
  ConflictError,
  OfflineError,
  ServerError,
  TimeoutError,
} from '@/data/remote/contracts/backendErrors';
import { classifyIntercityError, intercityErrorMessage, isSeatsUnavailable } from '../errors';

function conflict(code?: string, message?: string) {
  return new ConflictError({
    status: 409,
    cause: code ? { error: { code, message } } : undefined,
  });
}

describe('intercity failure classification', () => {
  test('409 SEATS_UNAVAILABLE is a recoverable outcome, not a crash', () => {
    const failure = classifyIntercityError(conflict('SEATS_UNAVAILABLE', 'conflict'));
    expect(failure.kind).toBe('seats-unavailable');
    expect(failure.shouldRefresh).toBe(true);
    expect(failure.message).toMatch(/just taken/i);
    expect(isSeatsUnavailable(conflict('SEATS_UNAVAILABLE'))).toBe(true);
  });

  test('an UNLABELLED 409 on a seat write is also treated as the lost seat race', () => {
    // The seat UPDATE returns zero rows for six different reasons, so the
    // server answers one generic conflict. Guessing anything else would show
    // the passenger a dead end instead of a refreshed list.
    const failure = classifyIntercityError(conflict());
    expect(failure.kind).toBe('seats-unavailable');
    expect(failure.shouldRefresh).toBe(true);
  });

  test('the seat-race copy is ours, never the server generic wording', () => {
    const failure = classifyIntercityError(conflict('SEATS_UNAVAILABLE', 'conflict on intercity_trips'));
    expect(failure.message).not.toMatch(/intercity_trips/);
  });

  test('an expired hold is distinguished from a lost race', () => {
    expect(classifyIntercityError(conflict('HOLD_EXPIRED')).kind).toBe('hold-expired');
  });

  test('a duplicate booking is distinguished from a lost race', () => {
    expect(classifyIntercityError(conflict('ACTIVE_BOOKING_EXISTS')).kind).toBe('already-booked');
  });

  test('402 NO_CREDITS surfaces as its own publishing blocker', () => {
    const error = new BackendError('backend_unavailable', 'Payment required', { status: 402 });
    expect(classifyIntercityError(error).kind).toBe('no-credits');
  });

  test('offline and timeout are designed states, and retryable', () => {
    expect(classifyIntercityError(new OfflineError({})).kind).toBe('offline');
    expect(classifyIntercityError(new OfflineError({})).retryable).toBe(true);
    expect(classifyIntercityError(new TimeoutError({})).kind).toBe('timeout');
  });

  test('a server error is retryable but never asks the user to refresh seat counts', () => {
    const failure = classifyIntercityError(new ServerError({ status: 500 }));
    expect(failure.kind).toBe('server');
    expect(failure.retryable).toBe(true);
    expect(failure.shouldRefresh).toBe(false);
  });

  test('a non-backend throwable still produces user-facing copy', () => {
    expect(classifyIntercityError(new Error('boom')).kind).toBe('unknown');
    expect(intercityErrorMessage(new Error('boom'))).toMatch(/try again/i);
    expect(intercityErrorMessage(undefined)).toBeTruthy();
  });
});
