import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { profileRepository } from './repository';
import type { DriverProfile, ProfileIdentity, ProfilePhoto, UserProfile } from './types';
import type { User } from '@/types';
import { clearProfilePhoto, uploadProfilePhoto } from '@/services/profile';
import { reportOperationalFailure } from '@/observability/monitoring';
import {
  loadProfilePhotoUri,
  useProfilePhotoQuery,
  useProfileQuery,
  useUpdateProfileMutation,
} from '@/query/hooks/useProfileQuery';

function buildIdentity(user: User | null, profilePhoto: ProfilePhoto | null): ProfileIdentity | null {
  if (!user) return null;
  return {
    userId: user.id,
    fullName: user.name,
    phoneNumber: user.phone,
    email: user.email,
    profilePhoto,
    preferredLanguage: undefined,
    notificationPreferences: undefined,
  };
}

export function useProfile() {
  const auth = useAuth();
  const profileQuery = useProfileQuery();
  const photoQuery = useProfilePhotoQuery();

  const profile = useMemo<UserProfile | null>(() => {
    const user = profileQuery.data?.user ?? auth.user;
    if (!user) return null;
    const profilePhoto = photoQuery.data ? { uri: photoQuery.data } : profileQuery.data?.profilePhoto ?? null;
    return {
      userId: user.id,
      fullName: user.name,
      phoneNumber: user.phone,
      email: user.email,
      profilePhoto,
      preferredLanguage: undefined,
      notificationPreferences: undefined,
      mode: user.mode,
      isDriver: user.isDriver,
      createdAt: user.createdAt,
      preferences: undefined,
    };
  }, [auth.user, photoQuery.data, profileQuery.data?.profilePhoto, profileQuery.data?.user]);

  return {
    ...auth,
    profile,
  };
}

export function useProfileActions(fallbackImage?: string | null) {
  const { logout, switchMode, updateUser: updateAuthUser } = useAuth();
  const updateProfile = useUpdateProfileMutation();
  const photo = useProfilePhoto(fallbackImage);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      const next = await updateProfile.mutateAsync(updates);
      if (next) {
        await updateAuthUser(updates);
      }
    },
    [updateAuthUser, updateProfile],
  );

  return {
    logout,
    switchMode,
    updateUser,
    ...photo,
  };
}

export function useProfileIdentity() {
  const { user } = useAuth();
  const photoQuery = useProfilePhotoQuery();
  return useMemo(() => buildIdentity(user, photoQuery.data ? { uri: photoQuery.data } : null), [photoQuery.data, user]);
}

export function useProfilePhoto(fallbackImage?: string | null) {
  const { driverProfile, saveDriverProfile } = useAuth();
  const { showToast } = useToast();
  const [storedProfileImage, setStoredProfileImage] = useState<string | null>(fallbackImage ?? null);

  const profileImage = storedProfileImage ?? fallbackImage ?? null;

  // Reads the account photo, not just this install's cache — see loadProfilePhotoUri.
  const refreshProfileImage = useCallback(async () => {
    const next = await loadProfilePhotoUri();
    setStoredProfileImage(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refreshProfileImage().then(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
    }, [refreshProfileImage]),
  );

  useEffect(() => {
    setStoredProfileImage(fallbackImage ?? null);
  }, [fallbackImage]);

  const handleImagePick = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        let result: ImagePicker.ImagePickerResult;
        if (source === 'camera') {
          if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission required', 'Camera access is needed to take a photo.');
              return null;
            }
          }
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
            allowsEditing: true,
            aspect: [1, 1],
          });
        } else {
          if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission required', 'Photo library access is needed.');
              return null;
            }
          }
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
            allowsEditing: true,
            aspect: [1, 1],
          });
        }
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          // Show the picked file straight away, then replace it with the stored
          // URL. Only the uploaded URL survives a reinstall or a second handset —
          // a `file://` URI is meaningless anywhere but this install.
          await profileRepository.saveProfileImage(asset.uri);
          setStoredProfileImage(asset.uri);
          try {
            const remoteUrl = await uploadProfilePhoto(asset.uri, asset.mimeType ?? 'image/jpeg');
            await profileRepository.saveProfileImage(remoteUrl);
            setStoredProfileImage(remoteUrl);
            showToast('Photo updated', 'info');
            return remoteUrl;
          } catch (error) {
            // The photo is on this device but not on the account. Say so rather
            // than claiming success — the user would otherwise only discover it
            // on their next phone.
            reportOperationalFailure('profile.photo.upload', error);
            showToast("Photo saved on this phone — we couldn't sync it. Try again.", 'info');
            return asset.uri;
          }
        }
      } catch (error) {
        console.error('Failed to pick image:', error);
        Alert.alert('Error', `Failed to pick image: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    },
    [showToast],
  );

  const handleDeletePhoto = useCallback(async () => {
    await profileRepository.removeProfileImage();
    setStoredProfileImage(null);
    // Clear it on the account too, otherwise the next sign-in re-hydrates the
    // photo the user just deleted. Best-effort: the local removal already
    // happened and must not be undone by a network failure.
    try {
      await clearProfilePhoto();
    } catch (error) {
      reportOperationalFailure('profile.photo.clear', error);
    }
    if (driverProfile) {
      const nextProfile: DriverProfile = { ...driverProfile };
      delete nextProfile.profileImage;
      // Keep the compatibility driver projection in sync without changing ownership.
      await saveDriverProfile(nextProfile);
    }
    showToast('Photo removed', 'info');
  }, [driverProfile, saveDriverProfile, showToast]);

  return {
    profileImage,
    setProfileImage: () => undefined,
    refreshProfileImage,
    handleImagePick,
    handleDeletePhoto,
  };
}
