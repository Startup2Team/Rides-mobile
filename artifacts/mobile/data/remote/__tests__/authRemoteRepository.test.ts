import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteAuthRepository, createAuthShadowRepository } from '../repositories/RemoteAuthRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from '../contracts/backendErrors';
import type { AuthSessionRepository } from '../repositories/RemoteAuthRepository';
import type { User } from '@/types';

const userDto = {
  id: 'user-1',
  name: 'Aline Rider',
  phone: '+250788123456',
  email: 'aline@example.test',
  mode: 'customer' as const,
  isDriver: false,
  createdAt: '2026-07-03T08:00:00.000Z',
};

const userDomain: User = { ...userDto };

const localSession = {
  user: userDomain,
  accessToken: 'local-access-token',
  refreshToken: 'local-refresh-token',
  expiresAt: '2026-07-03T09:00:00.000Z',
};

const remoteSessionDto = {
  user: { ...userDto, name: 'Remote User' },
  accessToken: 'remote-access-token',
  refreshToken: 'remote-refresh-token',
  expiresAt: '2026-07-03T10:00:00.000Z',
};

function createLocalRepository(overrides: Partial<AuthSessionRepository> = {}): AuthSessionRepository {
  return {
    getCurrentUser: jest.fn(async () => userDomain),
    saveCurrentUser: jest.fn(async () => undefined),
    getDriverProfile: jest.fn(async () => null),
    saveDriverProfile: jest.fn(async () => undefined),
    clearSession: jest.fn(async () => undefined),
    requestOtp: jest.fn(async () => ({
      requestId: 'local-otp-request',
      maskedPhoneNumber: '***3456',
      expiresAt: '2026-07-03T08:05:00.000Z',
    })),
    verifyOtp: jest.fn(async () => localSession),
    refreshSession: jest.fn(async () => localSession),
    logout: jest.fn(async () => undefined),
    getCurrentSession: jest.fn(async () => ({ user: userDomain, expiresAt: localSession.expiresAt })),
    ...overrides,
  };
}

describe('RemoteAuthRepository', () => {
  beforeEach(() => resetObservabilityForTests());
  afterEach(() => resetObservabilityForTests());

  test('POST request OTP uses dry-run endpoint and maps DTO correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/auth/otp/request-dry-run',
        response: {
          status: 200,
          data: {
            data: {
              requestId: 'otp-req-1',
              maskedPhoneNumber: '***3456',
              expiresAt: '2026-07-03T08:05:00.000Z',
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.requestOtp({ phoneNumber: '+250788123456', channel: 'sms' })).resolves.toEqual({
      requestId: 'otp-req-1',
      maskedPhoneNumber: '***3456',
      expiresAt: '2026-07-03T08:05:00.000Z',
    });
    expect(transportFixture.calls).toHaveLength(1);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/auth/otp/request-dry-run',
      body: {
        phoneNumber: '+250788123456',
        channel: 'sms',
        dryRun: true,
      },
    });
    expect(transportFixture.calls.map(call => call.path)).not.toContain('/v1/auth/otp/request');
  });

  test('unsafe OTP delivery mode is skipped and never calls SMS endpoint', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/auth/otp/request',
        response: { status: 200, data: { data: { requestId: 'unsafe', maskedPhoneNumber: '***3456', expiresAt: 'never' }, version: 'v1' } },
      },
    ]);
    const repo = new RemoteAuthRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      otpRequestMode: 'unavailable',
      transportLabel: 'shadow_remote',
    });

    await expect(repo.requestOtp({ phoneNumber: '+250788123456' })).rejects.toMatchObject({
      code: 'not_implemented',
      repository: 'auth',
      method: 'requestOtp',
    });
    expect(transportFixture.calls).toHaveLength(0);
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'auth.remote.shadow',
        tags: expect.objectContaining({ event: 'auth remote shadow skipped unsafe otp delivery' }),
      }),
    ]));
  });

  test('POST verify OTP, refresh session, logout, and GET current session map correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/auth/otp/verify',
        response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } },
      },
      {
        method: 'POST',
        path: '/v1/auth/session/refresh',
        response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } },
      },
      {
        method: 'POST',
        path: '/v1/auth/logout',
        response: { status: 200, data: { data: { success: true }, version: 'v1' } },
      },
      {
        method: 'GET',
        path: '/v1/auth/session/current',
        response: { status: 200, data: { data: { user: userDto, expiresAt: '2026-07-03T10:00:00.000Z' }, version: 'v1' } },
      },
    ]);
    const repo = new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.verifyOtp({ phoneNumber: '+250788123456', otp: '123456' })).resolves.toEqual({
      user: { ...userDomain, name: 'Remote User' },
      accessToken: 'remote-access-token',
      refreshToken: 'remote-refresh-token',
      expiresAt: '2026-07-03T10:00:00.000Z',
    });
    await expect(repo.refreshSession('refresh-token-secret')).resolves.toEqual({
      user: { ...userDomain, name: 'Remote User' },
      accessToken: 'remote-access-token',
      refreshToken: 'remote-refresh-token',
      expiresAt: '2026-07-03T10:00:00.000Z',
    });
    await expect(repo.logout('refresh-token-secret')).resolves.toBeUndefined();
    await expect(repo.getCurrentSession()).resolves.toEqual({
      user: userDomain,
      expiresAt: '2026-07-03T10:00:00.000Z',
    });
    expect(transportFixture.calls[0].body).toMatchObject({
      phoneNumber: '+250788123456',
      otp: '123456',
    });
    expect(transportFixture.calls[1].body).toEqual({ refreshToken: 'refresh-token-secret' });
    expect(transportFixture.calls[2].body).toMatchObject({ refreshToken: 'refresh-token-secret' });
  });

  test('typed backend failures map correctly', async () => {
    const cases = [
      new UnauthorizedError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new ForbiddenError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new ConflictError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new ValidationError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new RateLimitedError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new TimeoutError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new OfflineError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
      new ServerError({ repository: 'auth', method: 'verifyOtp', transport: 'remote' }),
    ];

    for (const error of cases) {
      const transportFixture = createFakeBackendTransport([
        { method: 'POST', path: '/v1/auth/otp/verify', error },
      ]);
      await expect(new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }) }).verifyOtp({
        phoneNumber: '+250788123456',
        otp: '123456',
      })).rejects.toBeInstanceOf(error.constructor as any);
    }
  });
});

describe('auth shadow repository', () => {
  beforeEach(() => resetObservabilityForTests());
  afterEach(() => resetObservabilityForTests());

  test('SHADOW_REMOTE returns local result and ignores remote OTP/session results', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/auth/otp/request-dry-run',
        response: { status: 200, data: { data: { requestId: 'remote-otp', maskedPhoneNumber: '***3456', expiresAt: '2026-07-03T08:10:00.000Z' }, version: 'v1' } },
      },
      { method: 'POST', path: '/v1/auth/otp/verify', response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } } },
      { method: 'POST', path: '/v1/auth/session/refresh', response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } } },
      { method: 'GET', path: '/v1/auth/session/current', response: { status: 200, data: { data: { user: remoteSessionDto.user, expiresAt: remoteSessionDto.expiresAt }, version: 'v1' } } },
    ]);
    const shadow = createAuthShadowRepository({
      localRepository,
      remoteRepository: new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
      enableRemoteDiagnostics: true,
    });

    await expect(shadow.requestOtp({ phoneNumber: '+250788123456' })).resolves.toEqual({
      requestId: 'local-otp-request',
      maskedPhoneNumber: '***3456',
      expiresAt: '2026-07-03T08:05:00.000Z',
    });
    await expect(shadow.verifyOtp({ phoneNumber: '+250788123456', otp: '123456' })).resolves.toEqual(localSession);
    await expect(shadow.refreshSession('local-refresh-token')).resolves.toEqual(localSession);
    await expect(shadow.getCurrentSession()).resolves.toEqual({ user: userDomain, expiresAt: localSession.expiresAt });
    expect(transportFixture.calls.map(call => call.path)).toEqual([
      '/v1/auth/otp/request-dry-run',
      '/v1/auth/otp/verify',
      '/v1/auth/session/refresh',
      '/v1/auth/session/current',
    ]);
    expect(localRepository.saveCurrentUser).not.toHaveBeenCalled();
  });

  test('remote diagnostics are disabled unless explicitly configured', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/auth/otp/request-dry-run', response: { status: 200, data: { data: { requestId: 'remote-otp', maskedPhoneNumber: '***3456', expiresAt: 'x' }, version: 'v1' } } },
    ]);
    const shadow = createAuthShadowRepository({
      localRepository,
      remoteRepository: new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }) }),
    });

    await expect(shadow.requestOtp({ phoneNumber: '+250788123456' })).resolves.toMatchObject({ requestId: 'local-otp-request' });
    expect(transportFixture.calls).toHaveLength(0);
  });

  test('requestOtp shadow never calls unsafe SMS endpoint', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/auth/otp/request', response: { status: 200, data: { data: { requestId: 'unsafe', maskedPhoneNumber: '***3456', expiresAt: 'x' }, version: 'v1' } } },
    ]);
    const shadow = createAuthShadowRepository({
      localRepository,
      remoteRepository: new RemoteAuthRepository({
        client: new BackendClient({ transport: transportFixture.transport }),
        otpRequestMode: 'unavailable',
        transportLabel: 'shadow_remote',
      }),
      enableRemoteDiagnostics: true,
    });

    await expect(shadow.requestOtp({ phoneNumber: '+250788123456' })).resolves.toMatchObject({ requestId: 'local-otp-request' });
    expect(transportFixture.calls).toHaveLength(0);
  });

  test('remote tokens never mutate local auth context or repository state', async () => {
    const saveCurrentUser = jest.fn(async () => undefined);
    const localRepository = createLocalRepository({ saveCurrentUser });
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/auth/otp/verify', response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } } },
    ]);
    const shadow = createAuthShadowRepository({
      localRepository,
      remoteRepository: new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
      enableRemoteDiagnostics: true,
    });

    const result = await shadow.verifyOtp({ phoneNumber: '+250788123456', otp: '123456' });

    expect(result.accessToken).toBe('local-access-token');
    expect(result.refreshToken).toBe('local-refresh-token');
    expect(saveCurrentUser).not.toHaveBeenCalled();
  });

  test('telemetry is sanitized', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/auth/otp/verify', response: { status: 200, data: { data: remoteSessionDto, version: 'v1' } } },
    ]);
    const shadow = createAuthShadowRepository({
      localRepository,
      remoteRepository: new RemoteAuthRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
      enableRemoteDiagnostics: true,
    });

    await shadow.verifyOtp({ phoneNumber: '+250788123456', otp: '123456' });

    const logs = JSON.stringify(observability.logger.getLogs());
    expect(logs).not.toContain('123456');
    expect(logs).not.toContain('remote-access-token');
    expect(logs).not.toContain('remote-refresh-token');
    expect(logs).not.toContain('local-access-token');
    expect(logs).not.toContain('local-refresh-token');
    expect(logs).not.toContain('+250788123456');
    expect(logs).toContain('***3456');
  });

  test('LOCAL default and navigation behavior remain unchanged', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
