import { authRepository, profileRepository } from '@/data/repositories';
import { profileKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export function useProfileQuery() {
  return usePolicyQuery(queryPolicies.profile, {
    queryKey: profileKeys.current(),
    queryFn: async () => {
      const [user, driverProfile, profileImage] = await Promise.all([
        authRepository.getCurrentUser(),
        authRepository.getDriverProfile(),
        profileRepository.getProfileImage(),
      ]);
      return {
        user,
        driverProfile,
        profileImage,
      };
    },
  });
}
