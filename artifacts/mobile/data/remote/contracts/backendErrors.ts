export type BackendErrorCode =
  | 'backend_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'server_error'
  | 'timeout'
  | 'offline'
  | 'serialization_failed'
  | 'not_implemented';

export interface BackendErrorDetails {
  repository?: string;
  method?: string;
  transport?: string;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly repository?: string;
  readonly method?: string;
  readonly transport?: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(code: BackendErrorCode, message: string, details: BackendErrorDetails = {}) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.repository = details.repository;
    this.method = details.method;
    this.transport = details.transport;
    this.status = details.status;
    this.retryable = details.retryable ?? false;
    this.cause = details.cause;
  }
}

export class BackendUnavailableError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('backend_unavailable', 'Backend unavailable', details);
    this.name = 'BackendUnavailableError';
  }
}

export class UnauthorizedError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('unauthorized', 'Unauthorized', details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('forbidden', 'Forbidden', details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('conflict', 'Conflict', details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('validation_failed', 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

export class RateLimitedError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('rate_limited', 'Rate limited', details);
    this.name = 'RateLimitedError';
  }
}

export class ServerError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('server_error', 'Server error', details);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('timeout', 'Timeout', details);
    this.name = 'TimeoutError';
  }
}

export class OfflineError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('offline', 'Offline', details);
    this.name = 'OfflineError';
  }
}

export class SerializationError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('serialization_failed', 'Serialization failed', details);
    this.name = 'SerializationError';
  }
}

export class NotImplementedError extends BackendError {
  constructor(details: BackendErrorDetails = {}) {
    super('not_implemented', 'Not implemented', details);
    this.name = 'NotImplementedError';
  }
}

export function createBackendUnavailableError(repository: string, method: string, transport = 'remote') {
  return new BackendUnavailableError({
    repository,
    method,
    transport,
    retryable: true,
  });
}

export function createNotImplementedError(repository: string, method: string, transport = 'remote') {
  return new NotImplementedError({
    repository,
    method,
    transport,
  });
}
