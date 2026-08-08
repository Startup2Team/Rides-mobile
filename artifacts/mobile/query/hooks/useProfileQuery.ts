import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authRepository } from '@/data/repositories/authRepository';
import { profileRepository } from '@/domains/profile/repository';
import type { ProfilePhoto, UserProfile } from '@/domains/profile';
import type { User } from '@/types';
import { fetchProfile, updateProfile } from '@/services/profile';
import { profileKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export interface SharedProfileSnapshot {
  user: User | null;
  profilePhoto: ProfilePhoto | null;
}

export interface UpdateProfileInput extends Partial<User> {}

export interface UpdatePhoneInput {
  phone: string;
}

function toProfilePhoto(uri: string | null): ProfilePhoto | null {
  return uri ? { uri } : null;
}

function mergeProfileSnapshot(
  current: SharedProfileSnapshot | undefined,
  updates: Partial<User> = {},
  profilePhoto?: ProfilePhoto | null,
): SharedProfileSnapshot {
  return {
    user: current?.user ? { ...current.user, ...updates } : current?.user ?? null,
    profilePhoto: profilePhoto !== undefined ? profilePhoto : current?.profilePhoto ?? null,
  };
}

function setProfileCache(queryClient: QueryClient, snapshot: SharedProfileSnapshot) {
  queryClient.setQueryData(profileKeys.current(), snapshot);
  queryClient.setQueryData(profileKeys.photo(), snapshot.profilePhoto?.uri ?? null);
}

/**
 * The avatar URI to render.
 *
 * Local storage is only a cache of the account's `profile_image_url`; on a fresh
 * install or a second handset it is empty, which is why the photo did not follow
 * the user. Fall back to the backend and mirror what it returns so subsequent
 * reads stay local (and keep working offline).
 */
export async function loadProfilePhotoUri(): Promise<string | null> {
  const local = await profileRepository.getProfileImage();
  if (local) return local;
  try {
    const remote = await fetchProfile();
    if (!remote.profileImageUrl) return null;
    await profileRepository.saveProfileImage(remote.profileImageUrl);
    return remote.profileImageUrl;
  } catch {
    // Offline / unauthenticated — no photo to show, same as before.
    return null;
  }
}

export function useProfileQuery() {
  return usePolicyQuery(queryPolicies.profile, {
    queryKey: profileKeys.current(),
    queryFn: async () => {
      const [storedUser, profileImage] = await Promise.all([
        authRepository.getCurrentUser(),
        profileRepository.getProfileImage(),
      ]);
      // Backend is authoritative for the display fields (GET /customer/profile).
      // Merge them onto the stored user (which owns mode/isDriver/etc.), persist
      // so the cache stays consistent, and fall back to the stored user when
      // offline or unauthenticated so the screen never goes blank.
      let user = storedUser;
      let photoUri = profileImage;
      if (storedUser) {
        try {
          const remote = await fetchProfile();
          user = {
            ...storedUser,
            name: remote.fullName || storedUser.name,
            email: remote.email ?? storedUser.email,
            emergencyContactName: remote.emergencyContactName ?? storedUser.emergencyContactName,
            emergencyContactPhone: remote.emergencyContactPhone ?? storedUser.emergencyContactPhone,
          };
          await authRepository.saveCurrentUser(user);
          // The account's avatar wins over whatever this install happens to hold:
          // on a fresh install there IS no local URI, and an old local `file://`
          // from a previous device would never load. Mirror it into local storage
          // so the offline path below has something renderable next time.
          if (remote.profileImageUrl && remote.profileImageUrl !== photoUri) {
            photoUri = remote.profileImageUrl;
            await profileRepository.saveProfileImage(remote.profileImageUrl);
          }
        } catch {
          // Offline / unreachable — keep the locally stored profile.
        }
      }
      return {
        user,
        profilePhoto: toProfilePhoto(photoUri),
      } satisfies SharedProfileSnapshot;
    },
  });
}

export function useProfilePhotoQuery() {
  return usePolicyQuery(queryPolicies.profile, {
    queryKey: profileKeys.photo(),
    queryFn: async () => loadProfilePhotoUri(),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateProfileInput) => {
      const current = await authRepository.getCurrentUser();
      if (!current) return null;
      const next = { ...current, ...updates };
      // Push the backend-owned display fields first (PUT /customer/profile).
      // Phone changes go through the dedicated OTP flow, not here.
      if (updates.name !== undefined || updates.email !== undefined) {
        await updateProfile({
          ...(updates.name !== undefined ? { fullName: updates.name } : {}),
          ...(updates.email !== undefined ? { email: updates.email ?? null } : {}),
        });
      }
      await authRepository.saveCurrentUser(next);
      return next;
    },
    onMutate: async updates => {
      await queryClient.cancelQueries({ queryKey: profileKeys.current() });
      await queryClient.cancelQueries({ queryKey: profileKeys.photo() });
      const previous = queryClient.getQueryData<SharedProfileSnapshot>(profileKeys.current()) ?? { user: null, profilePhoto: null };
      const next = mergeProfileSnapshot(previous, updates);
      setProfileCache(queryClient, next);
      return { previous };
    },
    onError: (_error, _updates, context) => {
      if (!context) return;
      setProfileCache(queryClient, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

export function useUpdatePhoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePhoneInput) => {
      const current = await authRepository.getCurrentUser();
      if (!current) return null;
      const next = { ...current, phone: input.phone };
      await authRepository.saveCurrentUser(next);
      return next;
    },
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: profileKeys.current() });
      await queryClient.cancelQueries({ queryKey: profileKeys.photo() });
      const previous = queryClient.getQueryData<SharedProfileSnapshot>(profileKeys.current()) ?? { user: null, profilePhoto: null };
      const next = mergeProfileSnapshot(previous, { phone: input.phone });
      setProfileCache(queryClient, next);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      setProfileCache(queryClient, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

export function useUpdateProfilePhotoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uri: string | null) => {
      if (uri) {
        await profileRepository.saveProfileImage(uri);
      } else {
        await profileRepository.removeProfileImage();
      }
      return uri;
    },
    onMutate: async uri => {
      await queryClient.cancelQueries({ queryKey: profileKeys.current() });
      await queryClient.cancelQueries({ queryKey: profileKeys.photo() });
      const previous = queryClient.getQueryData<SharedProfileSnapshot>(profileKeys.current()) ?? { user: null, profilePhoto: null };
      const next = {
        ...previous,
        profilePhoto: toProfilePhoto(uri),
      };
      setProfileCache(queryClient, next);
      return { previous };
    },
    onError: (_error, _uri, context) => {
      if (!context) return;
      setProfileCache(queryClient, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.current() });
      await queryClient.invalidateQueries({ queryKey: profileKeys.photo() });
    },
  });
}
