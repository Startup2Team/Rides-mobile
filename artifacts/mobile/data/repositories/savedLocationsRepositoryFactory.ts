import { savedLocationsRepository as localSavedLocationsRepository } from '@/data/adapters/localRepositories';
import type { SavedLocationsRepository } from './interfaces';
import { createSavedLocationsStagingShadowRepository } from '@/data/remote/staging/createSavedLocationsStagingShadow';
import type { SavedLocationsStagingShadowFactoryOptions } from '@/data/remote/staging/createSavedLocationsStagingShadow';

let cachedRepository: SavedLocationsRepository | null = null;

export function createSavedLocationsRepository(
  options: Partial<SavedLocationsStagingShadowFactoryOptions> = {},
): SavedLocationsRepository {
  return createSavedLocationsStagingShadowRepository({
    localRepository: options.localRepository ?? localSavedLocationsRepository,
    env: options.env,
    fetchImpl: options.fetchImpl,
    tokenProvider: options.tokenProvider,
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
