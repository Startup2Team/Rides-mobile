import { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  loadStoredProfileImage,
  saveStoredProfileImage,
  removeStoredProfileImage,
} from '@/persistence/profilePersistence';

export function useProfilePhotoActions(fallbackImage?: string | null) {
  const { driverProfile, saveDriverProfile } = useAuth();
  const { showToast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(fallbackImage ?? null);

  useEffect(() => {
    loadStoredProfileImage().then(stored => {
      if (stored.data) {
        setProfileImage(stored.data);
      } else if (fallbackImage) {
        setProfileImage(fallbackImage);
      }
    });
  }, [fallbackImage]);

  const handleImagePick = async (source: 'camera' | 'gallery') => {
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
        await saveStoredProfileImage(asset.uri);
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
  };

  const handleDeletePhoto = async () => {
    setProfileImage(null);
    await removeStoredProfileImage();
    if (driverProfile) {
      const nextProfile = { ...driverProfile };
      delete nextProfile.profileImage;
      await saveDriverProfile(nextProfile);
    }
    showToast('Photo removed', 'info');
  };

  return {
    profileImage,
    setProfileImage,
    handleImagePick,
    handleDeletePhoto,
  };
}
