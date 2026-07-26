import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteProfileRepository, createProfileShadowRepository } from '../repositories/RemoteProfileRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { OfflineError, ServerError, TimeoutError } from '../contracts/backendErrors';
import { dtoToDomainProfile, profileIdentityToDto } from '../mappers/profileMapper';
import type { ProfileDto } from '../contracts/api';
import type { ProfileIdentity, UserProfile } from '@/domains/profile';
import type { ProfileRepository } from '@/data/repositories/interfaces';
import { uploadFileBytes } from '@/services/driverDocuments';

// The byte transfer itself is a raw fetch to object storage; stub it so these
// tests cover the repository's request sequence, not the network.
jest.mock('@/services/driverDocuments', () => ({
  uploadFileBytes: jest.fn().mockResolvedValue(undefined),
}));

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

const profileDto: ProfileDto = {
  id: currentProfile.userId,
  displayName: currentProfile.fullName,
  phoneNumber: currentProfile.phoneNumber,
  photoUrl: currentProfile.profilePhoto?.uri ?? null,
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

describe('RemoteProfileRepository', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('maps profile DTOs to the shared domain identity', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/profile/me',
        response: {
          status: 200,
          data: {
            data: profileDto,
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(repo.getCurrentProfile(currentProfile)).resolves.toEqual(currentProfile);
    await expect(repo.getProfileImage()).resolves.toBe('file://profile.jpg');
    expect(transportFixture.calls[0]).toMatchObject({ method: 'GET', path: '/v1/profile/me' });
  });

  test('update profile maps domain changes to dto and back', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/profile/me',
        response: {
          status: 200,
          data: {
            data: {
              ...profileDto,
              displayName: 'Alice Updated',
              phoneNumber: '+250788222333',
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    const next = await repo.updateProfile(
      { name: 'Alice Updated', phone: '+250788222333' },
      createMetadata({ displayName: 'Alice Updated', phoneNumber: '+250788222333' }),
      currentProfile,
    );

    expect(next).toMatchObject({
      userId: 'user-1',
      fullName: 'Alice Updated',
      phoneNumber: '+250788222333',
    });
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/profile/me',
      body: expect.objectContaining({
        displayName: 'Alice Updated',
        phoneNumber: '+250788222333',
        photoUrl: 'file://profile.jpg',
      }),
    });
  });

  test('profile photo upload presigns, stores the bytes, then persists the URL', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/uploads/presigned-url',
        response: {
          status: 200,
          data: {
            data: {
              upload_url: 'https://storage.example/avatars/abc.jpg?sig=x',
              file_url: 'https://cdn.example/avatars/abc.jpg',
            },
            version: 'v1',
          },
        },
      },
      {
        method: 'PUT',
        path: '/v1/customer/profile',
        response: { status: 204, data: { data: null, version: 'v1' } },
      },
    ]);
    const repo = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    // The stored photo is the public URL from storage, never the local file://
    // path — that distinction is exactly what used to be lost.
    await expect(
      repo.uploadProfilePhoto('file://new-profile.jpg', createMetadata(), currentProfile),
    ).resolves.toEqual({ uri: 'https://cdn.example/avatars/abc.jpg' });

    expect(uploadFileBytes).toHaveBeenCalledWith(
      'https://storage.example/avatars/abc.jpg?sig=x',
      'file://new-profile.jpg',
      'image/jpeg',
    );
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/uploads/presigned-url',
      body: expect.objectContaining({ content_type: 'image/jpeg', purpose: 'profile_image' }),
    });
    expect(transportFixture.calls[1]).toMatchObject({
      method: 'PUT',
      path: '/v1/customer/profile',
      body: expect.objectContaining({ profile_image_url: 'https://cdn.example/avatars/abc.jpg' }),
    });
  });

  test('a rejected upload propagates instead of resolving to a photo', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'POST',
        path: '/v1/uploads/presigned-url',
        response: {
          status: 200,
          data: {
            data: {
              upload_url: 'https://storage.example/avatars/abc.jpg?sig=x',
              file_url: 'https://cdn.example/avatars/abc.jpg',
            },
            version: 'v1',
          },
        },
      },
    ]);
    // A dead storage credential answers 401 — the repository must surface it,
    // not report a saved photo.
    (uploadFileBytes as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('upload failed with status 401'), { status: 401 }),
    );
    const repo = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    // The 401 must survive as an authorization failure. Previously any raw
    // upload error became BackendUnavailableError, i.e. "you're offline".
    await expect(
      repo.uploadProfilePhoto('file://new-profile.jpg', createMetadata(), currentProfile),
    ).rejects.toMatchObject({ name: 'UnauthorizedError', status: 401 });
  });

  test('phone update maps dto correctly', async () => {
    const transportFixture = createFakeBackendTransport([
      {
        method: 'PATCH',
        path: '/v1/profile/me/phone',
        response: {
          status: 200,
          data: {
            data: {
              ...profileDto,
              phoneNumber: '+250788999999',
            },
            version: 'v1',
          },
        },
      },
    ]);
    const repo = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });

    await expect(
      repo.updatePhoneNumber('+250788999999', '123456', createMetadata({ phoneNumber: '+250788999999', otp: '123456' }), currentProfile),
    ).resolves.toMatchObject({
      userId: 'user-1',
      phoneNumber: '+250788999999',
    });
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'PATCH',
      path: '/v1/profile/me/phone',
      body: expect.objectContaining({
        phoneNumber: '+250788999999',
        otp: '123456',
      }),
    });
  });

  test('typed errors map correctly', async () => {
    const timeoutTransport = createFakeBackendTransport([
      { method: 'GET', path: '/v1/profile/me', error: new TimeoutError({ repository: 'profile', method: 'getCurrentProfile', transport: 'remote' }) },
    ]);
    const offlineTransport = createFakeBackendTransport([
      { method: 'POST', path: '/v1/uploads/presigned-url', error: new OfflineError({ repository: 'profile', method: 'uploadProfilePhoto', transport: 'remote' }) },
    ]);
    const serverTransport = createFakeBackendTransport([
      { method: 'PATCH', path: '/v1/profile/me/phone', error: new ServerError({ repository: 'profile', method: 'updatePhoneNumber', transport: 'remote' }) },
    ]);

    const timeoutRepo = new RemoteProfileRepository({ client: new BackendClient({ transport: timeoutTransport.transport }) });
    const offlineRepo = new RemoteProfileRepository({ client: new BackendClient({ transport: offlineTransport.transport }) });
    const serverRepo = new RemoteProfileRepository({ client: new BackendClient({ transport: serverTransport.transport }) });

    await expect(timeoutRepo.getCurrentProfile(currentProfile)).rejects.toBeInstanceOf(TimeoutError);
    await expect(offlineRepo.uploadProfilePhoto('file://photo.jpg', createMetadata(), currentProfile)).rejects.toBeInstanceOf(OfflineError);
    await expect(serverRepo.updatePhoneNumber('+250788222333', '123456', createMetadata({ phoneNumber: '+250788222333', otp: '123456' }), currentProfile)).rejects.toBeInstanceOf(ServerError);
  });
});

describe('saved profile shadow remote wrapper', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('returns local results even when remote fails', async () => {
    const localRepository: ProfileRepository & { getCurrentProfile?: () => Promise<UserProfile | null> } = {
      getProfileImage: jest.fn(async () => 'file://local-profile.jpg'),
      saveProfileImage: jest.fn(async () => undefined),
      removeProfileImage: jest.fn(async () => undefined),
      getCurrentProfile: jest.fn(async () => currentProfile),
    };
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/profile/me', error: new TimeoutError({ repository: 'profile', method: 'getCurrentProfile', transport: 'remote' }) },
      { method: 'POST', path: '/v1/profile/me/photo', error: new TimeoutError({ repository: 'profile', method: 'uploadProfilePhoto', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/profile/me', error: new TimeoutError({ repository: 'profile', method: 'updateProfile', transport: 'remote' }) },
    ]);
    const remoteRepository = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createProfileShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getProfileImage()).resolves.toBe('file://local-profile.jpg');
    await expect(shadowRepository.saveProfileImage('file://updated.jpg')).resolves.toBeUndefined();
    await expect(shadowRepository.removeProfileImage()).resolves.toBeUndefined();
    await expect(shadowRepository.getCurrentProfile(currentProfile)).resolves.toEqual(currentProfile);

    expect(localRepository.getProfileImage).toHaveBeenCalled();
    expect(localRepository.saveProfileImage).toHaveBeenCalledWith('file://updated.jpg');
    expect(localRepository.removeProfileImage).toHaveBeenCalled();
  });

  test('ignores remote response for ui and records mismatch telemetry', async () => {
    const localRepository: ProfileRepository & { getCurrentProfile?: () => Promise<UserProfile | null> } = {
      getProfileImage: jest.fn(async () => 'file://local-profile.jpg'),
      saveProfileImage: jest.fn(async () => undefined),
      removeProfileImage: jest.fn(async () => undefined),
      getCurrentProfile: jest.fn(async () => currentProfile),
    };
    const transportFixture = createFakeBackendTransport([
      {
        method: 'GET',
        path: '/v1/profile/me',
        response: {
          status: 200,
          data: {
            data: {
              ...profileDto,
              photoUrl: 'file://remote-profile.jpg',
            },
            version: 'v1',
          },
        },
      },
    ]);
    const remoteRepository = new RemoteProfileRepository({
      client: new BackendClient({ transport: transportFixture.transport }),
      transportLabel: 'shadow_remote',
    });
    const shadowRepository = createProfileShadowRepository({
      localRepository,
      remoteRepository,
    });

    await expect(shadowRepository.getProfileImage()).resolves.toBe('file://local-profile.jpg');
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'profile.remote.shadow',
      'profile.remote.latency_ms',
      'profile.remote.shape_mismatch',
    ]));
  });

  test('profile identity remains a one-account mapping', () => {
    const identity: ProfileIdentity = {
      userId: currentProfile.userId,
      fullName: currentProfile.fullName,
      phoneNumber: currentProfile.phoneNumber,
      email: currentProfile.email,
      profilePhoto: currentProfile.profilePhoto,
      preferredLanguage: currentProfile.preferredLanguage,
      notificationPreferences: currentProfile.notificationPreferences,
    };
    expect(profileIdentityToDto(identity)).toEqual(profileDto);
    expect(dtoToDomainProfile(profileDto, currentProfile)).toMatchObject({
      userId: currentProfile.userId,
      fullName: currentProfile.fullName,
      phoneNumber: currentProfile.phoneNumber,
    });
  });

  test('default repository source remains local', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
