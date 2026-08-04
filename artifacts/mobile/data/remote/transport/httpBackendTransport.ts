import { observability } from '../../../observability/context/observabilityContext';
import type { BackendResponse, BackendTransport } from '../contracts/backendClientTypes';
import {
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from '../contracts/backendErrors';
import { DEFAULT_BACKEND_REQUEST_TIMEOUT_MS } from './backendTransportConfig';
import { DEFAULT_BACKEND_RETRY_POLICY, canRetryBackendRequest, delay, getRetryDelayMs } from './backendRetryPolicy';
import type { BackendRetryPolicy } from './backendRetryPolicy';
import type { HttpBackendTransportConfig } from './httpBackendTransportTypes';

const JSON_CONTENT_TYPE = 'application/json';

function makeRequestId(prefix: string, random = Math.random) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(random() * 1_000_000).toString(36)}`;
}

function appendQuery(url: URL, query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) return;
  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
}

function getHeader(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
}

function responseHeadersToRecord(headers: Headers) {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function idempotencyKeyFromBody(body: unknown) {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>).idempotencyKey;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function correlationIdFromBody(body: unknown) {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>).correlationId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mapStatusError(status: number, details: { method: string; cause?: unknown }) {
  const base = {
    repository: 'backend-client',
    method: details.method.toLowerCase(),
    transport: 'http',
    status,
    cause: details.cause,
    retryable: status === 429 || status >= 500,
  };
  if (status === 400 || status === 422) return new ValidationError(base);
  if (status === 401) return new UnauthorizedError(base);
  if (status === 403) return new ForbiddenError(base);
  if (status === 409) return new ConflictError(base);
  if (status === 429) return new RateLimitedError(base);
  if (status >= 500) return new ServerError(base);
  return new BackendUnavailableError(base);
}

function isAbortError(error: unknown) {
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted');
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return record.name === 'AbortError' || (typeof record.message === 'string' && record.message.toLowerCase().includes('aborted'));
  }
  return false;
}

function isLikelyOfflineError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('network request failed')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('offline');
}

async function parseResponse(response: Response, method: string): Promise<BackendResponse> {
  const headers = responseHeadersToRecord(response.headers);
  const contentType = getHeader(response.headers, 'content-type') ?? '';
  const rawText = await response.text();
  const hasBody = rawText.trim().length > 0;

  let data: unknown;
  if (!hasBody) {
    data = undefined;
  } else if (contentType.includes(JSON_CONTENT_TYPE) || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
    try {
      data = JSON.parse(rawText);
    } catch (cause) {
      throw new SerializationError({
        repository: 'backend-client',
        method: method.toLowerCase(),
        transport: 'http',
        status: response.status,
        cause,
      });
    }
  } else {
    data = rawText;
  }

  if (!response.ok) {
    throw mapStatusError(response.status, { method, cause: data });
  }

  return {
    status: response.status,
    data,
    headers,
  };
}

function recordTransportTelemetry(input: {
  method: string;
  status?: number;
  latencyMs: number;
  result: 'success' | 'failure' | 'timeout' | 'retry';
  correlationId: string;
  attempt: number;
  error?: unknown;
}) {
  const statusClass = input.status ? `${Math.floor(input.status / 100)}xx` : 'none';
  observability.metrics.counter('backend.http.request', 1, {
    method: input.method,
    result: input.result,
    statusClass,
  });
  observability.metrics.histogram('backend.http.latency_ms', input.latencyMs, {
    method: input.method,
    statusClass,
  });
  observability.logger.info('BackendHttpTransport', {
    method: input.method,
    result: input.result,
    statusClass,
    latencyMs: input.latencyMs,
    correlationId: input.correlationId,
    attempt: input.attempt,
    error: input.error instanceof Error ? input.error.name : undefined,
  });
}

async function resolveAuthHeader(tokenProvider: HttpBackendTransportConfig['tokenProvider']) {
  if (!tokenProvider) return undefined;
  const token = typeof tokenProvider === 'function' ? await tokenProvider() : tokenProvider;
  return token ? `Bearer ${token}` : undefined;
}

export function createHttpBackendTransport(
  config: HttpBackendTransportConfig,
  retryPolicy: BackendRetryPolicy = DEFAULT_BACKEND_RETRY_POLICY,
): BackendTransport {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_BACKEND_REQUEST_TIMEOUT_MS;
  const random = config.random ?? Math.random;

  return async function httpBackendTransport({ method, path, options = {} }) {
    const idempotencyKey = options.headers?.['X-Idempotency-Key'] ?? idempotencyKeyFromBody(options.body);
    const correlationId = options.headers?.['X-Correlation-Id'] ?? correlationIdFromBody(options.body) ?? makeRequestId('corr', random);
    const requestId = options.headers?.['X-Request-Id'] ?? makeRequestId('req', random);
    const retrySafe = options.retrySafe;
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      attempt += 1;
      const startedAt = Date.now();
      const controller = new AbortController();
      const configuredTimeoutMs = options.timeoutMs ?? timeoutMs;
      const timeoutId = setTimeout(() => controller.abort(), configuredTimeoutMs);
      const externalSignal = options.signal;
      const abortExternal = () => controller.abort();
      externalSignal?.addEventListener('abort', abortExternal);

      try {
        // Resolve paths RELATIVE to the full base (which includes /api), so a
        // leading-slash path like "/v1/auth/register" doesn't reset to the host
        // root and drop the "/api" segment. Strip the leading slash first.
        let relativePath = path.replace(/^\/+/, '');
        const cleanBase = config.baseUrl.replace(/\/+$/, '');
        if (cleanBase.endsWith('/v1') && relativePath.startsWith('v1/')) {
          relativePath = relativePath.slice(3);
        }
        const url = new URL(relativePath, `${cleanBase}/`);
        appendQuery(url, options.query);
        const authHeader = await resolveAuthHeader(config.tokenProvider);
        const headers: Record<string, string> = {
          Accept: JSON_CONTENT_TYPE,
          ...config.clientMetadata,
          ...options.headers,
          'X-Correlation-Id': correlationId,
          'X-Request-Id': requestId,
        };
        if (options.body !== undefined) headers['Content-Type'] = JSON_CONTENT_TYPE;
        if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
        if (authHeader) headers.Authorization = authHeader;

        const response = await fetchImpl(url.toString(), {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        const parsed = await parseResponse(response, method);
        recordTransportTelemetry({
          method,
          status: parsed.status,
          latencyMs: Date.now() - startedAt,
          result: 'success',
          correlationId,
          attempt,
        });
        return parsed;
      } catch (error) {
        const mapped = isAbortError(error)
          ? new TimeoutError({ repository: 'backend-client', method: method.toLowerCase(), transport: 'http', retryable: true, cause: error })
          : isLikelyOfflineError(error)
            ? new OfflineError({ repository: 'backend-client', method: method.toLowerCase(), transport: 'http', retryable: true, cause: error })
            : error;
        const retry = attempt < retryPolicy.maxAttempts && canRetryBackendRequest({ method, error: mapped, retrySafe, idempotencyKey });
        recordTransportTelemetry({
          method,
          status: mapped instanceof Error && 'status' in mapped ? (mapped as { status?: number }).status : undefined,
          latencyMs: Date.now() - startedAt,
          result: mapped instanceof TimeoutError ? 'timeout' : retry ? 'retry' : 'failure',
          correlationId,
          attempt,
          error: mapped,
        });
        if (!retry) throw mapped;
        await delay(getRetryDelayMs(attempt, retryPolicy, random));
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortExternal);
      }
    }

    throw new BackendUnavailableError({ repository: 'backend-client', method: method.toLowerCase(), transport: 'http', retryable: true });
  };
}
