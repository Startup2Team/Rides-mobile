import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { profileRepository } from './repository';
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
    // Auth session is the source of truth for the signed-in identity.
    // Prefer it over the profile query cache so a previous account's name
    // cannot linger after login/register (query key is not user-scoped).
    const queryUser = profileQuery.data?.user ?? null;
    const user = auth.user ?? queryUser;
    if (!user) return null;

    const queryMatchesSession = !auth.user || queryUser?.id === auth.user.id;
    const profilePhoto = queryMatchesSession
      ? (photoQuery.data
          ? { uri: photoQuery.data }
          : profileQuery.data?.profilePhoto ?? null)
      : null;

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
          await profileRepository.saveProfileImage(asset.uri);
          setStoredProfileImage(asset.uri);
          showToast('Photo updated', 'info');
          return asset.uri;
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
