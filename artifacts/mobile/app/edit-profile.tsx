import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';

import { loadStoredProfileImage, saveStoredProfileImage } from '@/persistence/profilePersistence';

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user, driverProfile, updateUser, saveDriverProfile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    loadStoredProfileImage().then(stored => {
      if (stored.data) setProfileImage(stored.data);
    });
  }, []);

  const handleImagePick = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
    }
  };

  const handlePickImage = () => {
    Alert.alert('Change Profile Photo', '', [
      { text: 'Take Photo', onPress: () => handleImagePick('camera') },
      { text: 'Choose from Gallery', onPress: () => handleImagePick('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    await updateUser({ name: name.trim(), email: email.trim() || undefined });
    setSaving(false);
    showToast('Profile updated', 'info');
    router.back();
  };

  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GlassHeader title="Edit Profile" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerMetrics.contentTop + 28, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85} style={styles.avatarContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
              <Feather name="camera" size={12} color={colors.primaryForeground} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
            Tap to change photo
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <AppInput
            label="Full Name"
            value={name}
            onChangeText={text => {
              setName(text);
              if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <AppInput
            label="Email (optional)"
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
          />

          {/* Phone — read-only */}
          <View style={[styles.readOnlyField, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.readOnlyLabelRow}>
              <Text style={[styles.readOnlyLabel, { color: colors.mutedForeground }]}>Phone Number</Text>
              <View style={[styles.lockedBadge, { backgroundColor: colors.border }]}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>Verified</Text>
              </View>
            </View>
            <Text style={[styles.readOnlyValue, { color: colors.foreground }]}>{user?.phone}</Text>
          </View>
          <Text style={[styles.phoneHint, { color: colors.mutedForeground }]}>
            To change your phone number, contact support.
          </Text>
        </View>

        <AppButton
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
        />
      </GlassScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 32, gap: 8 },
  avatarContainer: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  avatarHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  form: { gap: 16, marginBottom: 28 },
  readOnlyField: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  readOnlyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readOnlyLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lockedText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  readOnlyValue: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  phoneHint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -8 },
});
