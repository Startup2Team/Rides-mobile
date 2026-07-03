import type {
  AuthRepository,
  BookingRepository,
  DriverRepository,
  MapRepository,
  NotificationRepository,
  PackageRepository,
  PaymentRepository,
  ProfileRepository,
  RideRepository,
  SavedLocationsRepository,
  SearchRepository,
  VehicleRepository,
} from '@/data/repositories/interfaces';
import { observability } from '@/observability/context/observabilityContext';
import { createBackendUnavailableError } from '../contracts/backendErrors';
import type { BackendClient } from '../client/backendClient';
import { createRemoteSavedLocationsRepository as createRemoteSavedLocationsRepositoryImpl, createSavedLocationsShadowRepository } from './RemoteSavedLocationsRepository';
import { createRemoteRideRepositoryPrototype } from './RemoteRideRepository';
import { createRemoteDriverRepositoryPrototype } from './RemoteDriverRepository';
import { createRemoteAuthRepositoryPrototype } from './RemoteAuthRepository';
import { createRemoteSearchRepositoryPrototype } from './RemoteSearchRepository';
import { createRemoteMapRepositoryPrototype } from './RemoteMapRepository';

type RepoName =
  | 'auth'
  | 'profile'
  | 'booking'
  | 'ride'
  | 'savedLocations'
  | 'driver'
  | 'vehicle'
  | 'package'
  | 'notification'
  | 'payment'
  | 'search'
  | 'map';

function logRemoteRepositoryAttempt(repository: RepoName, method: string, result: 'success' | 'error' | 'ignored' | 'fallback', latencyMs: number, transport: 'remote' | 'shadow_remote' | 'hybrid' = 'remote', retry = false, responseShape: string = 'unavailable') {
  observability.metrics.counter('repository.remote.attempt', 1, {
    repository,
    method,
    transport,
    result,
    fallback: String(result === 'fallback'),
    retry: String(retry),
  });
  observability.metrics.histogram('repository.remote.latency_ms', latencyMs, {
    repository,
    method,
    transport,
  });
  observability.logger.info('RepositoryRemoteAttempt', {
    repository,
    method,
    transport,
    result,
    latencyMs,
    responseShape,
    retry,
  });
}

async function rejectUnavailable<T>(repository: RepoName, method: string): Promise<T> {
  const error = createBackendUnavailableError(repository, method);
  throw error;
}

async function executeShadowRemote<T>(
  repository: RepoName,
  method: string,
  local: () => Promise<T>,
  remote: () => Promise<T>,
): Promise<T> {
  const localStartedAt = Date.now();
  try {
    const localResult = await local();
    logRemoteRepositoryAttempt(repository, method, 'success', Date.now() - localStartedAt, 'shadow_remote', false, summarizeShape(localResult));
    const remoteStartedAt = Date.now();
    try {
      const remoteResult = await remote();
      logRemoteRepositoryAttempt(repository, method, 'ignored', Date.now() - remoteStartedAt, 'shadow_remote', false, summarizeShape(remoteResult));
    } catch (error) {
      logRemoteRepositoryAttempt(repository, method, 'error', Date.now() - remoteStartedAt, 'shadow_remote', false, summarizeShape(error));
    }
    return localResult;
  } catch (error) {
    logRemoteRepositoryAttempt(repository, method, 'error', Date.now() - localStartedAt, 'shadow_remote', false, summarizeShape(error));
    try {
      const remoteStartedAt = Date.now();
      await remote();
      logRemoteRepositoryAttempt(repository, method, 'fallback', Date.now() - remoteStartedAt, 'shadow_remote', true);
    } catch (remoteError) {
      logRemoteRepositoryAttempt(repository, method, 'error', 0, 'shadow_remote', true, summarizeShape(remoteError));
    }
    throw error;
  }
}

async function executeHybrid<T>(
  repository: RepoName,
  method: string,
  local: () => Promise<T>,
  remote: () => Promise<T>,
): Promise<T> {
  const localStartedAt = Date.now();
  try {
    const localResult = await local();
    logRemoteRepositoryAttempt(repository, method, 'success', Date.now() - localStartedAt, 'hybrid', false, summarizeShape(localResult));
    return localResult;
  } catch (error) {
    logRemoteRepositoryAttempt(repository, method, 'fallback', Date.now() - localStartedAt, 'hybrid', true, summarizeShape(error));
    const remoteStartedAt = Date.now();
    try {
      const remoteResult = await remote();
      logRemoteRepositoryAttempt(repository, method, 'success', Date.now() - remoteStartedAt, 'hybrid', true, summarizeShape(remoteResult));
      return remoteResult;
    } catch (remoteError) {
      logRemoteRepositoryAttempt(repository, method, 'error', Date.now() - remoteStartedAt, 'hybrid', true, summarizeShape(remoteError));
      throw remoteError;
    }
  }
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function createRemoteAuthRepository(client?: BackendClient): AuthRepository {
  return createRemoteAuthRepositoryPrototype({ client });
}

function createRemoteProfileRepositoryStub(client?: BackendClient): ProfileRepository {
  return {
    async getProfileImage() {
      void client;
      return rejectUnavailable('profile', 'getProfileImage');
    },
    async saveProfileImage() {
      void client;
      return rejectUnavailable('profile', 'saveProfileImage');
    },
    async removeProfileImage() {
      void client;
      return rejectUnavailable('profile', 'removeProfileImage');
    },
  };
}

function createRemoteBookingRepository(client?: BackendClient): BookingRepository {
  return {
    async getDraft() {
      void client;
      return rejectUnavailable('booking', 'getDraft');
    },
    async saveDraft() {
      void client;
      return rejectUnavailable('booking', 'saveDraft');
    },
    async clearDraft() {
      void client;
      return rejectUnavailable('booking', 'clearDraft');
    },
  };
}

function createRemoteRideRepository(client?: BackendClient): RideRepository {
  return createRemoteRideRepositoryPrototype({ client });
}

function createRemoteSavedLocationsRepository(client?: BackendClient): SavedLocationsRepository {
  return createRemoteSavedLocationsRepositoryImpl({ client });
}

function createRemoteDriverRepository(client?: BackendClient): DriverRepository {
  return createRemoteDriverRepositoryPrototype({ client });
}

function createRemoteVehicleRepository(client?: BackendClient): VehicleRepository {
  return {
    async getVehicles() {
      void client;
      return rejectUnavailable('vehicle', 'getVehicles');
    },
    async setActiveVehicle() {
      void client;
      return rejectUnavailable('vehicle', 'setActiveVehicle');
    },
    async setPrimaryVehicle() {
      void client;
      return rejectUnavailable('vehicle', 'setPrimaryVehicle');
    },
    async addVehicle() {
      void client;
      return rejectUnavailable('vehicle', 'addVehicle');
    },
    async updateVehicle() {
      void client;
      return rejectUnavailable('vehicle', 'updateVehicle');
    },
    async deleteVehicle() {
      void client;
      return rejectUnavailable('vehicle', 'deleteVehicle');
    },
  };
}

function createRemotePackageRepository(client?: BackendClient): PackageRepository {
  return {
    async getCatalog() {
      void client;
      return rejectUnavailable('package', 'getCatalog');
    },
    async refreshCatalog() {
      void client;
      return rejectUnavailable('package', 'refreshCatalog');
    },
    async getCampaigns() {
      void client;
      return rejectUnavailable('package', 'getCampaigns');
    },
    async refreshCampaigns() {
      void client;
      return rejectUnavailable('package', 'refreshCampaigns');
    },
    async getOfferSource() {
      void client;
      return rejectUnavailable('package', 'getOfferSource');
    },
    async refreshOfferSource() {
      void client;
      return rejectUnavailable('package', 'refreshOfferSource');
    },
  };
}

function createRemoteNotificationRepositoryStub(client?: BackendClient): NotificationRepository {
  return {
    async getReadState() {
      void client;
      return rejectUnavailable('notification', 'getReadState');
    },
    async saveReadState() {
      void client;
      return rejectUnavailable('notification', 'saveReadState');
    },
    async markRead() {
      void client;
      return rejectUnavailable('notification', 'markRead');
    },
    async markUnread() {
      void client;
      return rejectUnavailable('notification', 'markUnread');
    },
    async clear() {
      void client;
      return rejectUnavailable('notification', 'clear');
    },
  };
}

function createRemotePaymentRepository(client?: BackendClient): PaymentRepository {
  return {
    async listPaymentMethods() {
      void client;
      return rejectUnavailable('payment', 'listPaymentMethods');
    },
    async savePaymentMethods() {
      void client;
      return rejectUnavailable('payment', 'savePaymentMethods');
    },
    async addPaymentMethod() {
      void client;
      return rejectUnavailable('payment', 'addPaymentMethod');
    },
    async updatePaymentMethod() {
      void client;
      return rejectUnavailable('payment', 'updatePaymentMethod');
    },
    async removePaymentMethod() {
      void client;
      return rejectUnavailable('payment', 'removePaymentMethod');
    },
    async setDefaultPaymentMethod() {
      void client;
      return rejectUnavailable('payment', 'setDefaultPaymentMethod');
    },
  };
}

function createRemoteSearchRepository(client?: BackendClient): SearchRepository {
  return createRemoteSearchRepositoryPrototype({ client });
}

function createRemoteMapRepository(client?: BackendClient): MapRepository {
  return createRemoteMapRepositoryPrototype({ client });
}

export const remoteAuthRepository = createRemoteAuthRepository();
export const remoteProfileRepository = createRemoteProfileRepositoryStub();
export const remoteBookingRepository = createRemoteBookingRepository();
export const remoteRideRepository = createRemoteRideRepository();
export const remoteSavedLocationsRepository = createRemoteSavedLocationsRepository();
export const remoteDriverRepository = createRemoteDriverRepository();
export const remoteVehicleRepository = createRemoteVehicleRepository();
export const remotePackageRepository = createRemotePackageRepository();
export const remoteNotificationRepository = createRemoteNotificationRepositoryStub();
export const remotePaymentRepository = createRemotePaymentRepository();
export const remoteSearchRepository = createRemoteSearchRepository();
export const remoteMapRepository = createRemoteMapRepository();

export const remoteRepositories = {
  authRepository: remoteAuthRepository,
  bookingRepository: remoteBookingRepository,
  driverRepository: remoteDriverRepository,
  mapRepository: remoteMapRepository,
  notificationRepository: remoteNotificationRepository,
  packageRepository: remotePackageRepository,
  paymentRepository: remotePaymentRepository,
  profileRepository: remoteProfileRepository,
  rideRepository: remoteRideRepository,
  savedLocationsRepository: remoteSavedLocationsRepository,
  searchRepository: remoteSearchRepository,
  vehicleRepository: remoteVehicleRepository,
};

export {
  createRemoteAuthRepository,
  createRemoteBookingRepository,
  createRemoteDriverRepository,
  createRemoteMapRepository,
  createRemotePackageRepository,
  createRemotePaymentRepository,
  createRemoteRideRepository,
  createRemoteSavedLocationsRepository,
  createRemoteSearchRepository,
  createRemoteVehicleRepository,
  executeHybrid,
  executeShadowRemote,
  logRemoteRepositoryAttempt,
  createSavedLocationsShadowRepository,
  createRemoteProfileRepositoryStub,
  createRemoteNotificationRepositoryStub,
};
