import {
  fetchWithResilience,
  NetworkRequestError,
  parseJsonResponse,
} from '@/services/networkRequest';

function response(ok: boolean, status: number): Response {
  return { ok, status } as Response;
}

describe('fetchWithResilience', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws a typed timeout error when a request exceeds its deadline', async () => {
    global.fetch = jest.fn((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;

    await expect(
      fetchWithResilience('https://example.test', {}, {
        service: 'test',
        operation: 'timeout',
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({
      name: 'NetworkRequestError',
      kind: 'timeout',
      service: 'test',
      operation: 'timeout',
    });
  });

  it('propagates caller cancellation as a typed abort error', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;

    const request = fetchWithResilience(
      'https://example.test',
      { signal: controller.signal },
      {
        service: 'test',
        operation: 'abort',
        timeoutMs: 1_000,
      },
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: 'NetworkRequestError',
      kind: 'aborted',
      retryable: false,
    });
  });

  it('retries a retryable GET failure once and then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(false, 503))
      .mockResolvedValueOnce(response(true, 200)) as typeof fetch;

    const result = await fetchWithResilience('https://example.test', {}, {
      service: 'test',
      operation: 'retry',
      timeoutMs: 1_000,
      retries: 1,
      retryDelayMs: 0,
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable HTTP failures', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(false, 400)) as typeof fetch;

    await expect(
      fetchWithResilience('https://example.test', {}, {
        service: 'test',
        operation: 'http',
        timeoutMs: 1_000,
        retries: 1,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<NetworkRequestError>>({
        kind: 'http',
        status: 400,
        retryable: false,
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not put request URLs into typed error messages', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as typeof fetch;

    let error: NetworkRequestError | undefined;
    try {
      await fetchWithResilience(
        'https://example.test/private?address=secret',
        {},
        {
          service: 'test',
          operation: 'privacy',
          timeoutMs: 1_000,
        },
      );
    } catch (caught) {
      error = caught as NetworkRequestError;
    }

    expect(error?.message).toBe('test privacy request failed');
    expect(error?.message).not.toContain('secret');
  });

  it('converts malformed JSON into a typed invalid-response error', async () => {
    const malformed = {
      json: jest.fn().mockRejectedValue(new SyntaxError('private response body')),
    } as unknown as Response;

    await expect(parseJsonResponse(malformed, 'test', 'parse')).rejects.toMatchObject({
      name: 'NetworkRequestError',
      kind: 'invalid-response',
      service: 'test',
      operation: 'parse',
    });
  });
});
