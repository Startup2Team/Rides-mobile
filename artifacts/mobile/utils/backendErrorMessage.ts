import { BackendError } from '@/data/remote/contracts/backendErrors';

// The API answers a refusal with { error: { code, message } } and the transport
// parks that body on `cause`. Reading it is the difference between telling a
// user "we couldn't sign you in" and telling them their account is suspended
// until Thursday — the second is actionable, the first sends them in circles.

export interface BackendErrorBody {
  code: string | null;
  message: string | null;
}

export function readBackendError(error: unknown): BackendErrorBody {
  const cause = error instanceof BackendError ? error.cause : null;
  const body = cause && typeof cause === 'object' ? (cause as Record<string, unknown>).error : null;
  if (!body || typeof body !== 'object') return { code: null, message: null };
  const record = body as Record<string, unknown>;
  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : null;
  const message =
    typeof record.message === 'string' && record.message.trim() ? record.message.trim() : null;
  return { code, message };
}
