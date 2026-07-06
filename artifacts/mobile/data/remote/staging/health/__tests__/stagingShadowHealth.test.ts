import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { ProfileRepository } from '@/data/repositories/interfaces';
import type { SavedLocation, RideLocation } from '@/types';
import type { UserProfile } from '@/domains/profile';
import {
  createProfileStagingShadowRepository,
} from '../../createProfileStagingShadow';
import {
  createSavedLocationsStagingShadowRepository,
} from '../../createSavedLocationsStagingShadow';
import {
  formatStagingShadowHealthReport,
  getDomainStagingShadowHealth,
  getStagingShadowHealthReport,
  recordStagingShadowEvent,
  resetStagingShadowHealth,
} from '..';

const savedLocation: SavedLocation = {
  id: 'saved-1',
  label: 'Home',
  address: 'Kigali',
  latitude: -1.9441,
  longitude: 30.0619,
};

const rideLocation: RideLocation = {
  address: 'Kigali',
  latitude: -1.9441,
  longitude: 30.0619,
};

const profile: UserProfile = {
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

function stagingEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    nodeEnv: 'development',
    backendEnv: 'STAGING',
    backendBaseUrl: 'https://staging.example.invalid',
    savedLocationsRepositoryMode: 'SHADOW_REMOTE',
    profileRepositoryMode: 'SHADOW_REMOTE',
    savedLocationsShadowWritesEnabled: undefined,
    profileShadowWritesEnabled: undefined,
    ...overrides,
  };
}

function savedLocationsResponse(items: unknown[]) {
  return new Response(JSON.stringify({ data: { items }, version: 'v1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function profileResponse(overrides: Partial<{
  displayName: string;
  phoneNumber: string;
  photoUrl: string | null;
}> = {}) {
  return new Response(JSON.stringify({
    data: {
      id: profile.userId,
      displayName: overrides.displayName ?? profile.fullName,
      phoneNumber: overrides.phoneNumber ?? profile.phoneNumber,
      photoUrl: Object.prototype.hasOwnProperty.call(overrides, 'photoUrl')
        ? overrides.photoUrl
        : profile.profilePhoto?.uri ?? null,
    },
    version: 'v1',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSavedLocationsLocalRepository() {
  return {
    listSavedLocations: jest.fn(async () => [savedLocation]),
    replaceSavedLocations: jest.fn(async () => undefined),
    saveLocation: jest.fn(async (_location: RideLocation, _label: string) => true),
    removeSavedLocation: jest.fn(async (_id: string) => undefined),
    clearSavedLocations: jest.fn(async () => undefined),
  };
}

function makeProfileLocalRepository(): ProfileRepository {
  return {
    getProfileImage: jest.fn(async () => 'file://profile.jpg'),
    saveProfileImage: jest.fn(async () => undefined),
    removeProfileImage: jest.fn(async () => undefined),
  };
}

describe('staging shadow health report', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetStagingShadowHealth();
    jest.restoreAllMocks();
  });

  test('default report is idle and includes both domains', () => {
    const report = getStagingShadowHealthReport();

    expect(report.domains.map(domain => domain.domain)).toEqual(['profile', 'savedLocations']);
    expect(report.domains.every(domain => domain.status === 'idle')).toBe(true);
    expect(report.domains.every(domain => domain.recommendation === 'collect_data')).toBe(true);
  });

  test('saved locations become healthy after successful staging shadow attempts', async () => {
    const localRepository = makeSavedLocationsLocalRepository();
    const fetchImpl = jest.fn(async () => savedLocationsResponse([savedLocation]));
    const repository = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    }).repository;

    await repository.listSavedLocations();
    await repository.listSavedLocations();
    await repository.listSavedLocations();
    await repository.listSavedLocations();
    await repository.listSavedLocations();

    const health = getDomainStagingShadowHealth('savedLocations');
    expect(health.status).toBe('healthy');
    expect(health.shadowAttempts).toBe(5);
    expect(health.shadowSuccesses).toBe(5);
    expect(health.recommendation).toBe('continue_shadow');
  });

  test('profile becomes healthy after successful staging shadow attempts', async () => {
    const localRepository = makeProfileLocalRepository();
    const fetchImpl = jest.fn(async () => profileResponse());
    const repository = createProfileStagingShadowRepository({
      localRepository,
      env: stagingEnv(),
      fetchImpl,
    }).repository;

    await repository.getCurrentProfile(profile);
    await repository.getCurrentProfile(profile);
    await repository.getCurrentProfile(profile);
    await repository.getCurrentProfile(profile);
    await repository.getCurrentProfile(profile);

    const health = getDomainStagingShadowHealth('profile');
    expect(health.status).toBe('healthy');
    expect(health.shadowAttempts).toBe(5);
    expect(health.shadowSuccesses).toBe(5);
  });

  test('degraded and failing thresholds are distinguishable', () => {
    for (let i = 0; i < 4; i += 1) {
      recordStagingShadowEvent({
        domain: 'savedLocations',
        operation: 'listSavedLocations',
        event: 'shadow_attempted',
      });
      recordStagingShadowEvent({
        domain: 'savedLocations',
        operation: 'listSavedLocations',
        event: 'shadow_success',
      });
    }
    recordStagingShadowEvent({
      domain: 'savedLocations',
      operation: 'listSavedLocations',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'savedLocations',
      operation: 'listSavedLocations',
      event: 'shadow_failure',
      errorCategory: 'offline',
    });

    const degraded = getDomainStagingShadowHealth('savedLocations');
    expect(degraded.status).toBe('degraded');
    expect(degraded.recommendation).toBe('continue_shadow');

    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_failure',
      errorCategory: 'offline',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_failure',
      errorCategory: 'offline',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'profile',
      operation: 'getCurrentProfile',
      event: 'shadow_failure',
      errorCategory: 'offline',
    });

    const failing = getDomainStagingShadowHealth('profile');
    expect(failing.status).toBe('failing');
    expect(failing.recommendation).toBe('investigate');
  });

  test('blocked, collect_data, continue_shadow, and ready_for_hybrid_candidate are reported', () => {
    const empty = getDomainStagingShadowHealth('vehicles');
    expect(empty.status).toBe('idle');
    expect(empty.recommendation).toBe('collect_data');

    recordStagingShadowEvent({
      domain: 'vehicles',
      operation: 'listVehicles',
      event: 'shadow_attempted',
    });
    const insufficient = getDomainStagingShadowHealth('vehicles');
    expect(insufficient.status).toBe('degraded');
    expect(insufficient.recommendation).toBe('continue_shadow');

    for (let i = 0; i < 7; i += 1) {
      recordStagingShadowEvent({
        domain: 'map',
        operation: 'searchMap',
        event: 'shadow_attempted',
      });
      recordStagingShadowEvent({
        domain: 'map',
        operation: 'searchMap',
        event: 'shadow_success',
      });
    }
    const ready = getDomainStagingShadowHealth('map');
    expect(ready.status).toBe('healthy');
    expect(ready.recommendation).toBe('continue_shadow');

    recordStagingShadowEvent({
      domain: 'map',
      operation: 'searchMap',
      event: 'shadow_attempted',
    });
    recordStagingShadowEvent({
      domain: 'map',
      operation: 'searchMap',
      event: 'shadow_success',
    });

    const readyForHybrid = getDomainStagingShadowHealth('map');
    expect(readyForHybrid.recommendation).toBe('ready_for_hybrid_candidate');

    recordStagingShadowEvent({
      domain: 'auth',
      operation: 'handshake',
      event: 'skipped_invalid_config',
      errorCategory: 'malformed-url',
    });
    const blocked = getDomainStagingShadowHealth('auth');
    expect(blocked.status).toBe('blocked');
    expect(blocked.recommendation).toBe('blocked');
  });

  test('write shadow disabled is recorded and reset clears metrics', async () => {
    const localRepository = makeSavedLocationsLocalRepository();
    const fetchImpl = jest.fn(async () => savedLocationsResponse([savedLocation]));
    const repository = createSavedLocationsStagingShadowRepository({
      localRepository,
      env: stagingEnv({ savedLocationsShadowWritesEnabled: 'false' }),
      fetchImpl,
    }).repository;

    await repository.saveLocation(rideLocation, 'Home');

    const health = getDomainStagingShadowHealth('savedLocations');
    expect(health.skippedWriteShadowDisabled).toBeGreaterThan(0);

    resetStagingShadowHealth();
    const cleared = getStagingShadowHealthReport();
    expect(cleared.domains.every(domain => domain.shadowAttempts === 0)).toBe(true);
    expect(cleared.domains.every(domain => domain.status === 'idle')).toBe(true);
  });

  test('formatted report includes both default domains and future domains are accepted', () => {
    recordStagingShadowEvent({
      domain: 'search',
      operation: 'lookup',
      event: 'shadow_attempted',
    });

    const formatted = formatStagingShadowHealthReport();
    expect(formatted).toContain('savedLocations');
    expect(formatted).toContain('profile');
    expect(formatted).toContain('search');
  });
});
