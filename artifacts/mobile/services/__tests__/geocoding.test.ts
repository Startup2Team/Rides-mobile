import { geocodeAddress } from '@/services/geocoding';

describe('geocodeAddress network fallback', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('preserves the empty-result fallback when a provider request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as typeof fetch;

    await expect(geocodeAddress('Kigali')).resolves.toEqual([]);
  });

  it('propagates cancellation so stale callers cannot commit results', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch;

    const request = geocodeAddress('Kigali', undefined, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: 'NetworkRequestError',
      kind: 'aborted',
    });
  });
});
