import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { AppMode, DriverProfile, User, ProfileIdentity, ProfilePhoto, UserProfile } from './types';
import { profileRepository } from './repository';

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
  const { profileImage } = useProfilePhoto(auth.driverProfile?.profileImage ?? null);

  const profile = useMemo<UserProfile | null>(() => {
    if (!auth.user) return null;
    return {
      userId: auth.user.id,
      fullName: auth.user.name,
      phoneNumber: auth.user.phone,
      email: auth.user.email,
      profilePhoto: profileImage ? { uri: profileImage } : null,
      preferredLanguage: undefined,
      notificationPreferences: undefined,
      mode: auth.user.mode,
      isDriver: auth.user.isDriver,
      createdAt: auth.user.createdAt,
      preferences: undefined,
    };
  }, [auth.user, profileImage]);

  return {
    ...auth,
    profile,
  };
}

export function useProfileActions() {
  const { logout, switchMode, updateUser, saveDriverProfile } = useAuth();
  const photo = useProfilePhoto();

  return {
    logout,
    switchMode,
    updateUser,
    saveDriverProfile,
    ...photo,
  };
}

export function useProfileIdentity() {
  const { user } = useAuth();
  return useMemo(() => buildIdentity(user, null), [user]);
}

export function useProfilePhoto(fallbackImage?: string | null) {
  const { driverProfile, saveDriverProfile } = useAuth();
  const { showToast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(fallbackImage ?? null);

  const refreshProfileImage = useCallback(async () => {
    try {
      const stored = await profileRepository.getProfileImage();
      if (stored) {
        setProfileImage(stored);
      } else if (fallbackImage !== undefined) {
        setProfileImage(fallbackImage ?? null);
      } else {
        setProfileImage(null);
      }
    } catch {
      if (fallbackImage !== undefined) {
        setProfileImage(fallbackImage ?? null);
      }
    }
  }, [fallbackImage]);

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

  const handleImagePick = useCallback(async (source: 'camera' | 'gallery') => {
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
        setProfileImage(asset.uri);
        await profileRepository.saveProfileImage(asset.uri);
        if (driverProfile) {
          await saveDriverProfile({ ...driverProfile, profileImage: asset.uri });
        }
        showToast('Photo updated', 'info');
        return asset.uri;
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', `Failed to pick image: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }, [driverProfile, saveDriverProfile, showToast]);

  const handleDeletePhoto = useCallback(async () => {
    setProfileImage(null);
    await profileRepository.removeProfileImage();
    if (driverProfile) {
      const nextProfile: DriverProfile = { ...driverProfile };
      delete nextProfile.profileImage;
      await saveDriverProfile(nextProfile);
    }
    showToast('Photo removed', 'info');
  }, [driverProfile, saveDriverProfile, showToast]);

  return {
    profileImage,
    setProfileImage,
    refreshProfileImage,
    handleImagePick,
    handleDeletePhoto,
  };
}
