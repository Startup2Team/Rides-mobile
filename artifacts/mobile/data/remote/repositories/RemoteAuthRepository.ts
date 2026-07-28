import type { AuthRepository } from '@/data/repositories/interfaces';
import { authRepository as localAuthRepository } from '@/data/repositories';
import type { DriverProfile, User } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { getDeviceMetadata } from '../client/deviceMetadata';
import type {
  CurrentSessionResponseDto,
  LogoutResponseDto,
  RefreshSessionResponseDto,
  RequestOtpResponseDto,
  VerifyOtpResponseDto,
} from '../contracts/api';
import type { ApiEnvelope, ApiIdempotencyMetadata } from '../contracts/api/shared';
import {
  BackendError,
  createBackendUnavailableError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import {
  domainToLogoutDto,
  domainToRefreshSessionDto,
  domainToRequestOtpDto,
  domainToVerifyOtpDto,
  dtoToDomainAuthSession,
  dtoToDomainCurrentSession,
  dtoToDomainOtpRequest,
  errorToRepositoryFailureAuth,
  type AuthCurrentSessionDomain,
  type AuthOtpRequestInput,
  type AuthOtpRequestResult,
  type AuthSessionDomain,
  type AuthVerifyOtpInput,
} from '../mappers/authMapper';

export interface RemoteAuthRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
  otpRequestMode?: 'dry_run' | 'unavailable';
}

export interface AuthSessionRepository extends AuthRepository {
  requestOtp(input: AuthOtpRequestInput): Promise<AuthOtpRequestResult>;
  verifyOtp(input: AuthVerifyOtpInput): Promise<AuthSessionDomain>;
  refreshSession(refreshToken: string): Promise<AuthSessionDomain>;
  logout(refreshToken?: string | null): Promise<void>;
  getCurrentSession(): Promise<AuthCurrentSessionDomain | null>;
}

type AuthShadowLocalRepository = AuthRepository & Partial<AuthSessionRepository>;

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function maskPhone(phoneNumber?: string | null) {
  if (!phoneNumber) return null;
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `***${digits.slice(-4)}`;
}

function summarizeUser(user: User | null | undefined) {
  if (!user) return null;
  return {
    exists: true,
    id: user.id,
    mode: user.mode,
    isDriver: user.isDriver,
    phone: maskPhone(user.phone),
  };
}

function summarizeSession(session: AuthSessionDomain | AuthCurrentSessionDomain | null | undefined) {
  if (!session) return null;
  return {
    exists: true,
    user: summarizeUser(session.user),
    expiresAt: session.expiresAt,
  };
}

function metadata(action: string, subjectId: string): ApiIdempotencyMetadata {
  const timestamp = new Date().toISOString();
  return {
    idempotencyKey: `auth:${action}:${subjectId}`,
    correlationId: `auth:${action}:${subjectId}`,
    actorId: subjectId,
    actorRole: 'customer',
    clientTimestamp: timestamp,
  };
}

function recordTelemetry(
  event:
    | 'auth remote shadow request'
    | 'auth remote shadow success'
    | 'auth remote shadow failure'
    | 'auth remote shadow skipped unsafe otp delivery',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    phoneMasked?: string | null;
    mismatchCategory?: string;
    error?: unknown;
  },
) {
  observability.metrics.counter('auth.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
    mismatchCategory: context.mismatchCategory ?? 'none',
  });
  observability.metrics.histogram('auth.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('AuthRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    phoneMasked: context.phoneMasked,
    mismatchCategory: context.mismatchCategory,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown, category: string) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('auth.remote.shape_mismatch', 1, { method, category });
  }
  observability.metrics.counter('auth.remote.semantic_mismatch', 1, { method, category });
  observability.logger.warn('AuthRemoteShadowMismatch', {
    method,
    category,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('auth', method, 'remote');
  return client;
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailureAuth(error);
}

export class RemoteAuthRepository implements AuthSessionRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';
  private readonly otpRequestMode: 'dry_run' | 'unavailable';

  constructor(options: RemoteAuthRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
    this.otpRequestMode = options.otpRequestMode ?? 'dry_run';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>, phoneNumber?: string | null): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('auth remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
      phoneMasked: maskPhone(phoneNumber),
    });
    try {
      const value = await execute();
      recordTelemetry('auth remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
        phoneMasked: maskPhone(phoneNumber),
      });
      return value;
    } catch (error) {
      recordTelemetry('auth remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        phoneMasked: maskPhone(phoneNumber),
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async requestOtp(input: AuthOtpRequestInput): Promise<AuthOtpRequestResult> {
    return this.shadow('requestOtp', async () => {
      const client = resolveClient('requestOtp', this.client);
      const device = await getDeviceMetadata();
      // Real backend: POST /api/v1/auth/register sends the OTP.
      const response = await client.post<ApiEnvelope<RequestOtpResponseDto>>('/v1/auth/register', {
        body: domainToRequestOtpDto(input, device),
      });
      return dtoToDomainOtpRequest(response.data.data, input.phoneNumber);
    }, input.phoneNumber);
  }

  async verifyOtp(input: AuthVerifyOtpInput): Promise<AuthSessionDomain> {
    return this.shadow('verifyOtp', async () => {
      const client = resolveClient('verifyOtp', this.client);
      const device = await getDeviceMetadata();
      const response = await client.post<ApiEnvelope<VerifyOtpResponseDto>>('/v1/auth/verify-otp', {
        body: domainToVerifyOtpDto(input, device),
      });
      return dtoToDomainAuthSession(response.data.data, input.phoneNumber);
    }, input.phoneNumber);
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionDomain> {
    return this.shadow('refreshSession', async () => {
      const client = resolveClient('refreshSession', this.client);
      const response = await client.post<ApiEnvelope<RefreshSessionResponseDto>>('/v1/auth/refresh', {
        body: domainToRefreshSessionDto(refreshToken),
      });
      return dtoToDomainAuthSession(response.data.data);
    });
  }

  async logout(refreshToken?: string | null): Promise<void> {
    if (!refreshToken) {
      throw createBackendUnavailableError('auth', 'logout', this.transportLabel);
    }
    await this.shadow('logout', async () => {
      const client = resolveClient('logout', this.client);
      await client.post<ApiEnvelope<LogoutResponseDto>>('/v1/auth/logout', {
        body: domainToLogoutDto(refreshToken),
      });
    });
  }

  async getCurrentSession(): Promise<AuthCurrentSessionDomain | null> {
    return this.shadow('getCurrentSession', async () => {
      const client = resolveClient('getCurrentSession', this.client);
      const response = await client.get<ApiEnvelope<CurrentSessionResponseDto>>('/v1/auth/session/current');
      return response.data.data ? dtoToDomainCurrentSession(response.data.data) : null;
    });
  }

  async getCurrentUser(): Promise<User | null> {
    return this.shadow('getCurrentUser', async () => {
      const client = resolveClient('getCurrentUser', this.client);
      const response = await client.get<ApiEnvelope<CurrentSessionResponseDto>>('/v1/auth/session/current');
      return response.data.data ? dtoToDomainCurrentSession(response.data.data).user : null;
    });
  }

  async saveCurrentUser(_user?: User): Promise<void> {
    throw createNotImplementedError('auth', 'saveCurrentUser', this.transportLabel);
  }

  async getDriverProfile(): Promise<DriverProfile | null> {
    throw createNotImplementedError('auth', 'getDriverProfile', this.transportLabel);
  }

  async saveDriverProfile(): Promise<void> {
    throw createNotImplementedError('auth', 'saveDriverProfile', this.transportLabel);
  }

  async clearSession(): Promise<void> {
    throw createNotImplementedError('auth', 'clearSession', this.transportLabel);
  }
}

export function createRemoteAuthRepositoryPrototype(options: RemoteAuthRepositoryOptions = {}) {
  return new RemoteAuthRepository(options);
}

export function createAuthShadowRepository(options: {
  localRepository?: AuthShadowLocalRepository;
  remoteRepository: RemoteAuthRepository;
  enableRemoteDiagnostics?: boolean;
}): AuthSessionRepository {
  const localRepository: AuthShadowLocalRepository = options.localRepository ?? localAuthRepository;
  const { remoteRepository } = options;
  const enableRemoteDiagnostics = options.enableRemoteDiagnostics === true;

  async function runRemote<T>(method: string, remote: () => Promise<T>, compare?: (remoteValue: T) => void) {
    if (!enableRemoteDiagnostics) return;
    try {
      const remoteValue = await remote();
      compare?.(remoteValue);
    } catch (error) {
      observability.logger.warn('AuthRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  return {
    async requestOtp(input: AuthOtpRequestInput) {
      const local = localRepository.requestOtp
        ? await localRepository.requestOtp(input)
        : { requestId: 'local', maskedPhoneNumber: maskPhone(input.phoneNumber) ?? '****', expiresAt: new Date(0).toISOString() };
      await runRemote('requestOtp', () => remoteRepository.requestOtp(input), remote => {
        const localSummary = { exists: Boolean(local.requestId), phoneMasked: local.maskedPhoneNumber };
        const remoteSummary = { exists: Boolean(remote.requestId), phoneMasked: remote.maskedPhoneNumber };
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('requestOtp', localSummary, remoteSummary, 'otp_request');
        }
      });
      return local;
    },
    async verifyOtp(input: AuthVerifyOtpInput) {
      const local = localRepository.verifyOtp
        ? await localRepository.verifyOtp(input)
        : { user: null, accessToken: '', refreshToken: '', expiresAt: new Date(0).toISOString() };
      await runRemote('verifyOtp', () => remoteRepository.verifyOtp(input), remote => {
        const localSummary = summarizeSession(local);
        const remoteSummary = summarizeSession(remote);
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('verifyOtp', localSummary, remoteSummary, 'session');
        }
      });
      return local;
    },
    async refreshSession(refreshToken: string) {
      const local = localRepository.refreshSession
        ? await localRepository.refreshSession(refreshToken)
        : { user: null, accessToken: '', refreshToken: '', expiresAt: new Date(0).toISOString() };
      await runRemote('refreshSession', () => remoteRepository.refreshSession(refreshToken), remote => {
        const localSummary = summarizeSession(local);
        const remoteSummary = summarizeSession(remote);
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('refreshSession', localSummary, remoteSummary, 'session');
        }
      });
      return local;
    },
    async logout(refreshToken?: string | null) {
      if (localRepository.logout) {
        await localRepository.logout(refreshToken);
      } else {
        await localRepository.clearSession();
      }
      if (refreshToken) {
        await runRemote('logout', () => remoteRepository.logout(refreshToken));
      }
    },
    async getCurrentSession() {
      const local = localRepository.getCurrentSession
        ? await localRepository.getCurrentSession()
        : { user: await localRepository.getCurrentUser(), expiresAt: null };
      await runRemote('getCurrentSession', () => remoteRepository.getCurrentSession(), remote => {
        const localSummary = summarizeSession(local);
        const remoteSummary = summarizeSession(remote);
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('getCurrentSession', localSummary, remoteSummary, 'session');
        }
      });
      return local;
    },
    async getCurrentUser() {
      const local = await localRepository.getCurrentUser();
      await runRemote('getCurrentUser', () => remoteRepository.getCurrentUser(), remote => {
        const localSummary = summarizeUser(local);
        const remoteSummary = summarizeUser(remote);
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('getCurrentUser', localSummary, remoteSummary, 'user');
        }
      });
      return local;
    },
    async saveCurrentUser(user: User) {
      await localRepository.saveCurrentUser(user);
      await runRemote('saveCurrentUser', () => remoteRepository.saveCurrentUser(user));
    },
    async getDriverProfile() {
      return localRepository.getDriverProfile();
    },
    async saveDriverProfile(profile: DriverProfile) {
      await localRepository.saveDriverProfile(profile);
    },
    async clearSession() {
      await localRepository.clearSession();
    },
  };
}
