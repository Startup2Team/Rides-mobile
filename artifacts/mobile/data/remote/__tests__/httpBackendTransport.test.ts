import { BackendClient } from '../client/backendClient';
import {
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
import { createHttpBackendTransport } from '../transport/httpBackendTransport';
import { DEFAULT_BACKEND_RETRY_POLICY } from '../transport/backendRetryPolicy';
import { resetObservabilityForTests } from '@/observability/context/observabilityContext';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(status: number, body: string, contentType = 'text/plain') {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

describe('HttpBackendTransport', () => {
  beforeEach(() => {
    jest.useRealTimers();
    resetObservabilityForTests();
  });

  test('handles GET success with request headers and correlation IDs', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { data: { ok: true }, version: 'v1' }));
    const client = new BackendClient({
      transport: createHttpBackendTransport({
        baseUrl: 'https://staging.example.invalid',
        fetchImpl,
        random: () => 0.1,
      }),
    });

    await expect(client.get('/v1/saved-locations', { query: { limit: 5 } })).resolves.toMatchObject({
      status: 200,
      data: { data: { ok: true }, version: 'v1' },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://staging.example.invalid/v1/saved-locations?limit=5',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'X-Correlation-Id': expect.stringMatching(/^corr-/),
          'X-Request-Id': expect.stringMatching(/^req-/),
        }),
      }),
    );
  });

  test('handles POST, PATCH, and DELETE empty responses', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: 'saved-1' }, version: 'v1' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'saved-1', label: 'Work' }, version: 'v1' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new BackendClient({
      transport: createHttpBackendTransport({ baseUrl: 'https://staging.example.invalid', fetchImpl }),
    });

    await expect(client.post('/v1/saved-locations', { body: { idempotencyKey: 'idem-1', correlationId: 'corr-1' } })).resolves.toMatchObject({ status: 201 });
    await expect(client.patch('/v1/saved-locations/saved-1', { body: { idempotencyKey: 'idem-2', correlationId: 'corr-2' } })).resolves.toMatchObject({ status: 200 });
    await expect(client.delete('/v1/saved-locations/saved-1')).resolves.toEqual(expect.objectContaining({ status: 204, data: undefined }));

    expect(fetchImpl.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'idem-1',
      'X-Correlation-Id': 'corr-1',
    }));
    expect(fetchImpl.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      'X-Idempotency-Key': 'idem-2',
      'X-Correlation-Id': 'corr-2',
    }));
  });

  test.each([
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [409, ConflictError],
    [422, ValidationError],
    [429, RateLimitedError],
    [500, ServerError],
  ])('maps HTTP %s to typed backend error', async (status, ErrorClass) => {
    const fetchImpl = jest.fn(async () => jsonResponse(status, { error: { code: 'failure' } }));
    const client = new BackendClient({
      transport: createHttpBackendTransport({ baseUrl: 'https://staging.example.invalid', fetchImpl }, { ...DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 }),
    });

    await expect(client.get('/v1/saved-locations')).rejects.toBeInstanceOf(ErrorClass);
  });

  test('maps malformed JSON to SerializationError', async () => {
    const fetchImpl = jest.fn(async () => textResponse(200, '{bad-json', 'application/json'));
    const client = new BackendClient({
      transport: createHttpBackendTransport({ baseUrl: 'https://staging.example.invalid', fetchImpl }),
    });

    await expect(client.get('/v1/saved-locations')).rejects.toBeInstanceOf(SerializationError);
  });

  test('maps offline/network failures to OfflineError', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = new BackendClient({
      transport: createHttpBackendTransport({ baseUrl: 'https://staging.example.invalid', fetchImpl }, { ...DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 }),
    });

    await expect(client.get('/v1/saved-locations')).rejects.toBeInstanceOf(OfflineError);
  });

  test('aborts timed out requests and maps them to TimeoutError', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const client = new BackendClient({
      transport: createHttpBackendTransport({ baseUrl: 'https://staging.example.invalid', fetchImpl, timeoutMs: 25 }, { ...DEFAULT_BACKEND_RETRY_POLICY, maxAttempts: 1 }),
    });

    const request = client.get('/v1/saved-locations');
    const assertion = expect(request).rejects.toBeInstanceOf(TimeoutError);
    await jest.advanceTimersByTimeAsync(30);
    await assertion;
  });

  test('retries safe GET with bounded attempts', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'server_error' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { items: [] }, version: 'v1' }));
    const client = new BackendClient({
      transport: createHttpBackendTransport(
        { baseUrl: 'https://staging.example.invalid', fetchImpl, random: () => 0 },
        { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 },
      ),
    });

    await expect(client.get('/v1/saved-locations')).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not retry unsafe writes without explicit retry safety', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(500, { error: { code: 'server_error' } }));
    const client = new BackendClient({
      transport: createHttpBackendTransport(
        { baseUrl: 'https://staging.example.invalid', fetchImpl },
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 },
      ),
    });

    await expect(client.post('/v1/saved-locations', { body: { idempotencyKey: 'idem-1' } })).rejects.toBeInstanceOf(ServerError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('retries idempotent writes only when explicitly marked retry-safe', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'server_error' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'saved-1' }, version: 'v1' }));
    const client = new BackendClient({
      transport: createHttpBackendTransport(
        { baseUrl: 'https://staging.example.invalid', fetchImpl, random: () => 0 },
        { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 },
      ),
    });

    await expect(client.post('/v1/saved-locations', { body: { idempotencyKey: 'idem-1' }, retrySafe: true })).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
