import { savedLocationsRepository as localSavedLocationsRepository } from '@/data/adapters/localRepositories';
import type { SavedLocationsRepository } from './interfaces';
import { createSavedLocationsStagingShadowRepository } from '@/data/remote/staging/createSavedLocationsStagingShadow';
import type { SavedLocationsStagingShadowFactoryOptions } from '@/data/remote/staging/createSavedLocationsStagingShadow';
import { getAccessToken } from '@/persistence/authTokens';

let cachedRepository: SavedLocationsRepository | null = null;

export function createSavedLocationsRepository(
  options: Partial<SavedLocationsStagingShadowFactoryOptions> = {},
): SavedLocationsRepository {
  return createSavedLocationsStagingShadowRepository({
    localRepository: options.localRepository ?? localSavedLocationsRepository,
    env: options.env,
    fetchImpl: options.fetchImpl,
    // Same defect as the profile factory: the singleton below passes no options,
    // so forwarding only `options.tokenProvider` left every remote saved-location
    // call unauthenticated. Defaults to the stored session token.
    tokenProvider: options.tokenProvider ?? (() => getAccessToken()),
  }).repository;
}

export function getSavedLocationsRepository() {
  if (!cachedRepository) {
    cachedRepository = createSavedLocationsRepository();
  }
  return cachedRepository;
}

export function resetSavedLocationsRepositoryForTests() {
  cachedRepository = null;
}

export const savedLocationsRepository = getSavedLocationsRepository();
