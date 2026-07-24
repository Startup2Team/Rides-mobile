import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { profileRepository } from './repository';
import { fetchProfile, updateProfile, uploadProfilePhoto } from '@/services/profile';
import type { DriverProfile, ProfileIdentity, ProfilePhoto, UserProfile } from './types';
import type { User } from '@/types';
import { useProfilePhotoQuery, useProfileQuery, useUpdateProfileMutation } from '@/query/hooks/useProfileQuery';

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

  const refreshProfileImage = useCallback(async () => {
    const next = await profileRepository.getProfileImage();
    if (next) {
      setStoredProfileImage(next);
      return;
    }
    // No local cache (fresh install / a different device) — hydrate the avatar
    // from the backend profile, where it now lives as an R2 URL. Best-effort:
    // stay on whatever we have if offline.
    try {
      const profile = await fetchProfile();
      if (profile.profileImageUrl) {
        await profileRepository.saveProfileImage(profile.profileImageUrl);
        setStoredProfileImage(profile.profileImageUrl);
      }
    } catch {
      // Offline / unreachable — keep the current image.
    }
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
            // Compress + square-crop on capture so the uploaded avatar is small
            // (the "break them down" step) — full-res phone photos are wasteful
            // for a profile picture.
            quality: 0.7,
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
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
        }
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          // Optimistic preview from the local file while the upload runs.
          setStoredProfileImage(asset.uri);
          try {
            // Upload to R2 + persist the public URL on the backend profile, so
            // the avatar survives reinstall, syncs across devices, and is visible
            // to drivers/support — not siloed on this device.
            const fileUrl = await uploadProfilePhoto(asset.uri);
            await profileRepository.saveProfileImage(fileUrl);
            setStoredProfileImage(fileUrl);
            showToast('Photo updated', 'info');
            return fileUrl;
          } catch (uploadError) {
            console.error('Failed to upload profile photo:', uploadError);
            // Revert the optimistic preview to the last persisted image.
            await refreshProfileImage();
            showToast("Couldn't upload your photo. Check your connection and try again.", 'error');
            return null;
          }
        }
      } catch (error) {
        console.error('Failed to pick image:', error);
        Alert.alert('Error', `Failed to pick image: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    },
    [showToast, refreshProfileImage],
  );

  const handleDeletePhoto = useCallback(async () => {
    await profileRepository.removeProfileImage();
    setStoredProfileImage(null);
    // Clear it on the backend too, so it doesn't re-hydrate from R2 on next focus
    // / another device. Best-effort — local removal already happened.
    try {
      await updateProfile({ profileImageUrl: null });
    } catch {
      // Offline — the backend still holds the old URL; it'll clear on next delete.
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
