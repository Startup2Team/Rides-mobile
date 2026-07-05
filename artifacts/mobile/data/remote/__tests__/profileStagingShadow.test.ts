import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  createProfileStagingShadowRepository,
  resolveProfileStagingShadowConfig,
} from '../staging/createProfileStagingShadow';
import type { ProfileRepository } from '@/data/repositories/interfaces';
import type { UserProfile } from '@/domains/profile';
import * as authPersistence from '@/persistence/authPersistence';

const currentProfile: UserProfile = {
  userId: 'user-1',
  fullName: 'Alice Rider',
  phoneNumber: '+250788111000',
  email: 'alice@example.com',
  profilePhoto: { uri: 'file://profile.jpg' },
  preferredLanguage: 'en',
  notificationPreferences: { rideUpdates: true },
  mode: 'customer',
  isDriver: false,
  createdAt: '2026-06-28T00:00:00.000Z',
  preferences: {
    preferredLanguage: 'en',
    notificationPreferences: { rideUpdates: true },
  },
};

function createMetadata(overrides: Partial<{
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: 'customer' | 'driver' | 'system';
  clientTimestamp: string;
  displayName: string | null;
  phoneNumber: string;
  photoUrl: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  otp: string;
}> = {}) {
  return {
    idempotencyKey: 'profile:meta:1',
    correlationId: 'corr-profile-1',
    actorId: 'user-1',
    actorRole: 'customer' as const,
    clientTimestamp: '2026-07-02T10:00:00.000Z',
    displayName: 'Alice Rider',
    phoneNumber: '+250788111000',
    photoUrl: null,
    fileName: 'profile.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    otp: '123456',
    ...overrides,
  };
}

function createLocalRepository(): ProfileRepository {
  return {
    getProfileImage: jest.fn(async () => 'file://local-profile.jpg'),
    saveProfileImage: jest.fn(async () => undefined),
    removeProfileImage: jest.fn(async () => undefined),
  };
}

function stagingEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    nodeEnv: 'development',
    backendEnv: 'STAGING',
    backendBaseUrl: 'https://staging.example.invalid',
    profileRepositoryMode: 'SHADOW_REMOTE',
    profileShadowWritesEnabled: undefined,
    ...overrides,
  };
}

function profileResponse(overrides: Partial<{
  displayName: string;
  phoneNumber: string;
  photoUrl: string | null;
}> = {}) {
  return new Response(JSON.stringify({
    data: {
      id: currentProfile.userId,
      displayName: overrides.displayName ?? currentProfile.fullName,
      phoneNumber: overrides.phoneNumber ?? currentProfile.phoneNumber,
      photoUrl: Object.prototype.hasOwnProperty.call(overrides, 'photoUrl')
        ? overrides.photoUrl
        : currentProfile.profilePhoto?.uri ?? null,
    },
    version: 'v1',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Profile staging shadow integration', () => {
  beforeEach(() => {
    jest.useRealTimers();
    resetObservabilityForTests();
    jest.restoreAllMocks();
  });

  test('default, missing, invalid, and production configuration remain LOCAL', () => {
    expect(resolveProfileStagingShadowConfig({ nodeEnv: 'development' })).toMatchObject({ enabled: false, mode: 'LOCAL' });
    expect(resolveProfileStagingShadowConfig(stagingEnv({ profileRepositoryMode: 'LOCAL' }))).toMatchObject({ enabled: false, mode: 'LOCAL' });
    expect(resolveProfileStagingShadowConfig(stagingEnv({ backendBaseUrl: undefined }))).toMatchObject({ enabled: false, mode: 'LOCAL' });
    expect(resolveProfileStagingShadowConfig(stagingEnv({ backendBaseUrl: 'not-a-url' }))).toMatchObject({ enabled: false, mode: 'LOCAL', reason: 'malformed-url' });
    expect(resolveProfileStagingShadowConfig(stagingEnv({ nodeEnv: 'production' }))).toMatchObject({ enabled: false, mode: 'LOCAL', reason: 'production-shadow-disabled' });
  });

  test('explicit SHADOW_REMOTE and STAGING create the shadow repository', async () => {
    const localRepository = createLocalRepository();
    const fetchImpl = jest.fn(async () => profileResponse());
    const result = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    expect(result.mode).toBe('SHADOW_REMOTE');
    await expect(result.repository.getProfileImage()).resolves.toBe('file://local-profile.jpg');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('remote read result is ignored and mismatch telemetry stays sanitized', async () => {
    const localRepository = createLocalRepository();
    const fetchImpl = jest.fn(async () => profileResponse({
      displayName: 'Alice Updated',
      phoneNumber: '+250788222333',
      photoUrl: 'https://cdn.example.invalid/profile.jpg?sig=secret',
    }));
    const result = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    await expect(result.repository.getCurrentProfile(currentProfile)).resolves.toEqual(currentProfile);
    const logs = JSON.stringify(observability.logger.getLogs());
    expect(logs).not.toContain(currentProfile.phoneNumber);
    expect(logs).not.toContain(currentProfile.email ?? '');
    expect(logs).not.toContain('profile.jpg?sig=secret');
    expect(logs).toContain('mismatchCategory');
    expect(logs).toContain('fieldCategory');
  });

  test('remote read failure and timeout do not affect local results', async () => {
    const localRepository = createLocalRepository();
    const failureFetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const failureResult = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl: failureFetch,
    });

    await expect(failureResult.repository.getProfileImage()).resolves.toBe('file://local-profile.jpg');

    const timeoutFetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const timeoutResult = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl: timeoutFetch,
      timeoutMs: 25,
    });

    await expect(timeoutResult.repository.getProfileImage()).resolves.toBe('file://local-profile.jpg');
  });

  test('shadow writes are disabled by default', async () => {
    const localRepository = createLocalRepository();
    const fetchImpl = jest.fn(async () => profileResponse());
    const result = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    await expect(result.repository.saveProfileImage('file://updated.jpg')).resolves.toBeUndefined();
    await expect(result.repository.updateProfile(
      { name: 'Alice Updated' },
      createMetadata({ displayName: 'Alice Updated' }),
      currentProfile,
    )).resolves.toEqual(currentProfile);
    await expect(result.repository.uploadProfilePhoto(
      'file://updated.jpg',
      createMetadata({ fileName: 'updated.jpg' }),
      currentProfile,
    )).resolves.toEqual(currentProfile.profilePhoto ?? null);
    await expect(result.repository.updatePhoneNumber(
      '+250788222333',
      '123456',
      createMetadata({ phoneNumber: '+250788222333', otp: '123456' }),
      currentProfile,
    )).resolves.toEqual(currentProfile);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('shadow writes require an explicit flag and ignore remote results', async () => {
    const localRepository = createLocalRepository();
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(profileResponse({ photoUrl: 'https://cdn.example.invalid/profile-a.jpg' }))
      .mockResolvedValueOnce(profileResponse({ displayName: 'Remote Name', phoneNumber: currentProfile.phoneNumber }))
      .mockResolvedValueOnce(profileResponse({ photoUrl: 'https://cdn.example.invalid/profile-b.jpg' }))
      .mockResolvedValueOnce(profileResponse({ phoneNumber: '+250788333444' }))
      .mockResolvedValueOnce(profileResponse({ displayName: 'Remote Prefs' }));
    const result = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv({ profileShadowWritesEnabled: 'true' }),
      fetchImpl,
    });

    await expect(result.repository.saveProfileImage('file://updated.jpg')).resolves.toBeUndefined();
    await expect(result.repository.updateProfile(
      { name: 'Alice Updated' },
      createMetadata({ displayName: 'Alice Updated' }),
      currentProfile,
    )).resolves.toEqual(currentProfile);
    await expect(result.repository.uploadProfilePhoto(
      'file://updated.jpg',
      createMetadata({ fileName: 'updated.jpg' }),
      currentProfile,
    )).resolves.toEqual(currentProfile.profilePhoto ?? null);
    await expect(result.repository.updatePhoneNumber(
      '+250788222333',
      '123456',
      createMetadata({ phoneNumber: '+250788222333', otp: '123456' }),
      currentProfile,
    )).resolves.toEqual(currentProfile);
    await expect(result.repository.updatePreferences(
      { preferredLanguage: 'fr' },
      createMetadata(),
      currentProfile,
    )).resolves.toEqual(currentProfile);
    expect(fetchImpl).toHaveBeenCalled();
    expect(result.mode).toBe('SHADOW_REMOTE');
  });

  test('does not mutate auth persistence or session persistence', async () => {
    const saveUserSpy = jest.spyOn(authPersistence, 'saveStoredUser');
    const saveDriverSpy = jest.spyOn(authPersistence, 'saveStoredDriverProfile');
    const localRepository = createLocalRepository();
    const fetchImpl = jest.fn(async () => profileResponse());
    const result = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    });

    await expect(result.repository.updateProfile(
      { name: 'Alice Updated' },
      createMetadata({ displayName: 'Alice Updated' }),
      currentProfile,
    )).resolves.toEqual(currentProfile);

    expect(saveUserSpy).not.toHaveBeenCalled();
    expect(saveDriverSpy).not.toHaveBeenCalled();
  });
});
