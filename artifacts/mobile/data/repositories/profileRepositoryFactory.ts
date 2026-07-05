import { profileRepository as localProfileRepository } from '@/data/adapters/localRepositories';
import type { ProfileRepository } from './interfaces';
import { createProfileStagingShadowRepository } from '@/data/remote/staging/createProfileStagingShadow';
import type { ProfileStagingShadowFactoryOptions } from '@/data/remote/staging/createProfileStagingShadow';

let cachedRepository: ProfileRepository | null = null;

export function createProfileRepository(
  options: Partial<ProfileStagingShadowFactoryOptions> = {},
): ProfileRepository {
  return createProfileStagingShadowRepository({
    localRepository: options.localRepository ?? localProfileRepository,
    env: options.env,
    fetchImpl: options.fetchImpl,
    tokenProvider: options.tokenProvider,
  }).repository;
}

export function getProfileRepository() {
  if (!cachedRepository) {
    cachedRepository = createProfileRepository();
  }
  return cachedRepository;
}

export function resetProfileRepositoryForTests() {
  cachedRepository = null;
}

export const profileRepository = getProfileRepository();
