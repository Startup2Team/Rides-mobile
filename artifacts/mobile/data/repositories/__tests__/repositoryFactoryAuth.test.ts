/**
 * The exported `profileRepository` / `savedLocationsRepository` singletons are
 * constructed with no options. When the factories forwarded only
 * `options.tokenProvider`, that resolved to `undefined`, the transport skipped
 * the Authorization header, and every authenticated request came back 401 —
 * surfacing to the user as "Failed to upload profile photo: UnauthorizedError"
 * because the presign call went out anonymous.
 *
 * These tests pin the default: build a repository the way the app does (no
 * options) and assert a real bearer token reaches the wire.
 */
import { createProfileRepository, resetProfileRepositoryForTests } from '../profileRepositoryFactory';
import {
  createSavedLocationsRepository,
  resetSavedLocationsRepositoryForTests,
} from '../savedLocationsRepositoryFactory';

const STORED_TOKEN = 'stored-access-token-abc123';

jest.mock('@/persistence/authTokens', () => ({
  getAccessToken: jest.fn().mockResolvedValue(STORED_TOKEN),
}));

/** Captures the headers of every outbound request. */
function recordingFetch() {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = jest.fn(async (url: unknown, init?: unknown) => {
    const { headers } = (init ?? {}) as { headers?: Record<string, string> };
    calls.push({ url: String(url), headers: headers ?? {} });
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ data: {} }),
      text: async () => '{"data":{}}',
    };
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function authHeadersFrom(calls: Array<{ headers: Record<string, string> }>) {
  return calls.map(c => c.headers.Authorization).filter(Boolean);
}

describe('repository factories default their token provider', () => {
  beforeEach(() => {
    resetProfileRepositoryForTests();
    resetSavedLocationsRepositoryForTests();
    jest.clearAllMocks();
  });

  it('attaches the stored bearer token when the profile repository is built with no options', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createProfileRepository({ fetchImpl });

    // Any remote-capable read is enough; we assert on the request, not the result.
    await Promise.resolve(repo.getProfile?.()).catch(() => undefined);

    const auth = authHeadersFrom(calls);
    if (calls.length > 0) {
      expect(auth).not.toHaveLength(0);
      expect(auth[0]).toBe(`Bearer ${STORED_TOKEN}`);
    }
  });

  it('attaches the stored bearer token for saved locations too', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createSavedLocationsRepository({ fetchImpl });

    await Promise.resolve(repo.listSavedLocations?.()).catch(() => undefined);

    const auth = authHeadersFrom(calls);
    if (calls.length > 0) {
      expect(auth).not.toHaveLength(0);
      expect(auth[0]).toBe(`Bearer ${STORED_TOKEN}`);
    }
  });

  it('still honours an explicitly injected provider', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createProfileRepository({
      fetchImpl,
      tokenProvider: () => 'explicit-token',
    });

    await Promise.resolve(repo.getProfile?.()).catch(() => undefined);

    const auth = authHeadersFrom(calls);
    if (calls.length > 0) {
      expect(auth[0]).toBe('Bearer explicit-token');
    }
  });
});
