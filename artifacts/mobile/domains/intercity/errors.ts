import { BackendError } from '@/data/remote/contracts/backendErrors';
import { readBackendError } from '@/utils/backendErrorMessage';

// Intercity failure taxonomy.
//
// `409 SEATS_UNAVAILABLE` is an EXPECTED outcome, not a crash: someone else
// took the last seats between the render and the tap. The seat UPDATE (§4) is
// a single conditional statement, and zero rows affected conflates six causes,
// so the server answers one generic conflict. The app therefore treats any
// unlabelled 409 on the hold path as "the seats went away" and recovers by
// refreshing the list rather than by showing a raw error.

export type IntercityFailureKind =
  | 'seats-unavailable'
  | 'hold-expired'
  | 'already-booked'
  | 'booking-limit'
  | 'no-credits'
  | 'not-allowed'
  | 'not-found'
  | 'offline'
  | 'timeout'
  | 'rate-limited'
  | 'validation'
  | 'server'
  | 'unknown';

export interface IntercityFailure {
  kind: IntercityFailureKind;
  /** Copy to show the user. Server wording wins when it is actionable. */
  message: string;
  /** True when re-reading server truth is the right next step. */
  shouldRefresh: boolean;
  /** True when retrying the exact same call can plausibly succeed. */
  retryable: boolean;
}

const COPY: Record<IntercityFailureKind, string> = {
  'seats-unavailable':
    'Those seats were just taken. We have refreshed the trip with the seats still available.',
  'hold-expired': 'Your 5-minute hold expired and the seats were released. You can hold them again.',
  'already-booked': 'You already have a booking on this trip.',
  'booking-limit': 'You can hold seats on two trips at a time. Cancel one to book another.',
  'no-credits': 'You need ride credits before you can publish a trip.',
  'not-allowed': 'You are not allowed to do that.',
  'not-found': 'This trip is no longer available.',
  offline: 'You are offline. Connect to the internet and try again.',
  timeout: 'The network is slow right now. Try again.',
  'rate-limited': 'Too many attempts. Wait a moment and try again.',
  validation: 'Some details are not valid. Check them and try again.',
  server: 'Something went wrong on our side. Try again in a moment.',
  unknown: 'Something went wrong. Try again.',
};

const CODE_KINDS: Record<string, IntercityFailureKind> = {
  SEATS_UNAVAILABLE: 'seats-unavailable',
  TRIP_FULL: 'seats-unavailable',
  TRIP_CLOSED: 'seats-unavailable',
  HOLD_EXPIRED: 'hold-expired',
  BOOKING_EXPIRED: 'hold-expired',
  ACTIVE_BOOKING_EXISTS: 'already-booked',
  DUPLICATE_BOOKING: 'already-booked',
  BOOKING_LIMIT_REACHED: 'booking-limit',
  NO_CREDITS: 'no-credits',
  TRIP_NOT_FOUND: 'not-found',
  BOOKING_NOT_FOUND: 'not-found',
};

function fromKind(kind: IntercityFailureKind, serverMessage?: string | null): IntercityFailure {
  return {
    kind,
    // The server's own wording is preferred for the cases where it carries a
    // fact we don't have (which limit, which trip) — except for the seat race,
    // where our copy is the recovery instruction and the server's is generic.
    message:
      kind === 'seats-unavailable' || !serverMessage ? COPY[kind] : serverMessage,
    shouldRefresh:
      kind === 'seats-unavailable' ||
      kind === 'hold-expired' ||
      kind === 'already-booked' ||
      kind === 'not-found',
    retryable: kind === 'offline' || kind === 'timeout' || kind === 'server' || kind === 'rate-limited',
  };
}

export function classifyIntercityError(error: unknown): IntercityFailure {
  if (!(error instanceof BackendError)) {
    return fromKind('unknown');
  }

  const { code, message } = readBackendError(error);
  const mapped = code ? CODE_KINDS[code] : undefined;
  if (mapped) return fromKind(mapped, message);

  switch (error.code) {
    case 'offline':
      return fromKind('offline');
    case 'timeout':
      return fromKind('timeout');
    case 'rate_limited':
      return fromKind('rate-limited');
    case 'validation_failed':
      return fromKind('validation', message);
    case 'forbidden':
      return fromKind('not-allowed', message);
    case 'server_error':
      return fromKind('server');
    case 'conflict':
      // An unlabelled 409 on an intercity write can only be a lost seat race —
      // the seat UPDATE is the only conditional statement that returns zero
      // rows for six different reasons (§4).
      return fromKind('seats-unavailable');
    default:
      break;
  }

  // 402 has no dedicated transport error class; it arrives as a generic
  // backend_unavailable carrying the status.
  if (error.status === 402) return fromKind('no-credits', message);
  if (error.status === 404) return fromKind('not-found', message);

  return fromKind('unknown', message);
}

export function isSeatsUnavailable(error: unknown): boolean {
  return classifyIntercityError(error).kind === 'seats-unavailable';
}

export function intercityErrorMessage(error: unknown): string {
  return classifyIntercityError(error).message;
}
