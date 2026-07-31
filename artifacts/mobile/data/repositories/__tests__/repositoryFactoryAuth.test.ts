/**
 * The exported `profileRepository` / `savedLocationsRepository` singletons are
 * constructed with no options. When the factories forwarded only
 * `options.tokenProvider`, that resolved to `undefined`, the transport skipped
 * the Authorization header, and every authenticated request came back 401 —
 * surfacing to the user as "Failed to upload profile photo: UnauthorizedError"
 * because the presign call went out anonymous.
 *
 * These tests pin the default: build a repository the way the app does (no token
 * provider) and assert a real bearer token reaches the wire.
 *
 * REMOTE_ENV forces SHADOW_REMOTE. Without it both factories resolve to LOCAL
 * mode, no HTTP request is made at all, and any assertion about headers would
 * pass while proving nothing.
 */
import type { BackendTransportEnvironment } from '@/data/remote/transport/httpBackendTransportTypes';
import { createProfileRepository, resetProfileRepositoryForTests } from '../profileRepositoryFactory';
import {
  createSavedLocationsRepository,
  resetSavedLocationsRepositoryForTests,
} from '../savedLocationsRepositoryFactory';

const STORED_TOKEN = 'stored-access-token-abc123';

jest.mock('@/persistence/authTokens', () => ({
  getAccessToken: jest.fn().mockResolvedValue(STORED_TOKEN),
}));

const REMOTE_ENV: BackendTransportEnvironment = {
  backendEnv: 'staging',
  backendBaseUrl: 'https://stg-api.rides.rw/api',
  nodeEnv: 'test',
  profileRepositoryMode: 'SHADOW_REMOTE',
  profileShadowWritesEnabled: 'true',
  savedLocationsRepositoryMode: 'SHADOW_REMOTE',
  savedLocationsShadowWritesEnabled: 'true',
};

/** Captures the headers of every outbound request. */
function recordingFetch() {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl = jest.fn(async (url: unknown, init?: unknown) => {
    const { headers } = (init ?? {}) as { headers?: Record<string, string> };
    calls.push({ url: String(url), headers: headers ?? {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: null }),
      text: async () => '{"data":null}',
    } as unknown as Response;
  });
  return { calls, fetchImpl: impl as unknown as typeof fetch };
}

describe('repository factories default their token provider', () => {
  beforeEach(() => {
    resetProfileRepositoryForTests();
    resetSavedLocationsRepositoryForTests();
    jest.clearAllMocks();
  });

  it('sends the stored bearer token when the profile repository is built with no token provider', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createProfileRepository({ env: REMOTE_ENV, fetchImpl });

    await repo.getProfileImage().catch(() => undefined);

    // Non-vacuous: a request must actually have gone out.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${STORED_TOKEN}`);
  });

  it('sends the stored bearer token for saved locations too', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createSavedLocationsRepository({ env: REMOTE_ENV, fetchImpl });

    await repo.listSavedLocations().catch(() => undefined);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${STORED_TOKEN}`);
  });

  it('still honours an explicitly injected provider', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const repo = createProfileRepository({
      env: REMOTE_ENV,
      fetchImpl,
      tokenProvider: () => 'explicit-token',
    });

    await repo.getProfileImage().catch(() => undefined);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].headers.Authorization).toBe('Bearer explicit-token');
  });
});
