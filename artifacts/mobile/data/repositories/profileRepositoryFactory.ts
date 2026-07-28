import { profileRepository as localProfileRepository } from '@/data/adapters/localRepositories';
import type { ProfileRepository } from './interfaces';
import { createProfileStagingShadowRepository } from '@/data/remote/staging/createProfileStagingShadow';
import type { ProfileStagingShadowFactoryOptions } from '@/data/remote/staging/createProfileStagingShadow';
import { getAccessToken } from '@/persistence/authTokens';

let cachedRepository: ProfileRepository | null = null;

export function createProfileRepository(
  options: Partial<ProfileStagingShadowFactoryOptions> = {},
): ProfileRepository {
  return createProfileStagingShadowRepository({
    localRepository: options.localRepository ?? localProfileRepository,
    env: options.env,
    fetchImpl: options.fetchImpl,
    // Default to the stored session token rather than leaving this undefined.
    // The exported singleton below is built with no options at all, so
    // forwarding `options.tokenProvider` alone meant the transport never set an
    // Authorization header and every authenticated call 401'd — which is what
    // broke profile photo upload ("Failed to upload profile photo:
    // UnauthorizedError"). The presign request simply went out anonymous.
    // Same provider the shared appBackendClient uses.
    tokenProvider: options.tokenProvider ?? (() => getAccessToken()),
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
