import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { ProfilePhotoEditSheet } from '@/components/ProfilePhotoEditSheet';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useColors } from '@/hooks/useColors';
import { useProfilePhotoActions } from '@/hooks/useProfilePhotoActions';
import { formatRwandaPhoneInput, normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import { typography } from '@/constants/typography';

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user, driverProfile, updateUser, saveDriverProfile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName ?? '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }>({});
  const { profileImage, handleImagePick, handleDeletePhoto } = useProfilePhotoActions(driverProfile?.profileImage);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const handlePickImage = () => {
    setShowPhotoSheet(true);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (emergencyContactName.trim() || emergencyContactPhone.trim()) {
      if (!emergencyContactName.trim()) {
        errs.emergencyContactName = 'Contact name is required';
      }
      if (!emergencyContactPhone.trim()) {
        errs.emergencyContactPhone = 'Contact phone is required';
      } else {
        const normalized = normalizeRwandaPhoneNumber(emergencyContactPhone);
        if (!normalized) {
          errs.emergencyContactPhone = 'Enter a valid Rwanda phone number';
        }
      }
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
    await updateUser({
      name: name.trim(),
      email: email.trim() || undefined,
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() ? (normalizeRwandaPhoneNumber(emergencyContactPhone) || undefined) : undefined,
    });
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
          { paddingTop: headerMetrics.contentTop + 28, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85} style={styles.avatarContainer}>
            <View style={styles.avatarInner}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
              </View>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImageAbsolute} />
              ) : null}
            </View>
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
            label="Email"
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
          <View style={styles.phoneFieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Phone Number</Text>
            <TouchableOpacity
              accessibilityLabel="Change Phone Number"
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => router.push('/change-phone-number')}
              style={[styles.readOnlyField, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              <View style={styles.phoneValueRow}>
                <Text style={[styles.readOnlyValue, { color: colors.foreground }]}>{user?.phone}</Text>
                <Text style={[styles.changePhoneText, { color: colors.primary }]}>Change</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.emergencyHeaderGroup}>
            <Text style={[styles.sectionHeader, { color: colors.foreground }]}>Emergency Contact</Text>
            <Text style={[styles.emergencyHint, { color: colors.mutedForeground }]}>
              Add a contact person we can reach out to in case of an emergency or safety incident during a ride.
            </Text>
          </View>

          <AppInput
            label="Contact Name"
            value={emergencyContactName}
            onChangeText={text => {
              setEmergencyContactName(text);
              if (errors.emergencyContactName) setErrors(prev => ({ ...prev, emergencyContactName: undefined }));
            }}
            error={errors.emergencyContactName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <AppInput
            label="Contact Phone"
            value={emergencyContactPhone}
            onChangeText={text => {
              setEmergencyContactPhone(formatRwandaPhoneInput(text));
              if (errors.emergencyContactPhone) setErrors(prev => ({ ...prev, emergencyContactPhone: undefined }));
            }}
            error={errors.emergencyContactPhone}
            keyboardType="phone-pad"
            placeholder="e.g. 0788000000"
            autoCapitalize="none"
            returnKeyType="done"
          />
        </View>

        <AppButton
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
        />
      </GlassScrollView>

      <ProfilePhotoEditSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        profileImage={profileImage}
        onTakePhoto={async () => {
          const uri = await handleImagePick('camera');
          setShowPhotoSheet(false);
        }}
        onChoosePhoto={async () => {
          const uri = await handleImagePick('gallery');
          setShowPhotoSheet(false);
        }}
        onDeletePhoto={profileImage ? async () => {
          await handleDeletePhoto();
          setShowPhotoSheet(false);
        } : undefined}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 32, gap: 8 },
  avatarContainer: { position: 'relative', marginBottom: 4 },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImageAbsolute: { width: 80, height: 80, position: 'absolute', top: 0, left: 0 },
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
  avatarText: { ...typography.h1, fontFamily: typography.badge.fontFamily},
  avatarHint: { ...typography.caption, fontFamily: typography.body.fontFamily},
  form: { gap: 16, marginBottom: 28 },
  readOnlyField: {
    borderRadius: 12,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  readOnlyValue: { ...typography.body, fontFamily: typography.body.fontFamily},
  phoneValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  changePhoneText: { ...typography.label, fontFamily: typography.title.fontFamily},
  phoneHint: { ...typography.tiny, fontFamily: typography.body.fontFamily, marginTop: -8 },
  phoneFieldContainer: { gap: 6 },
  fieldLabel: {
    ...typography.label,
    fontFamily: typography.label.fontFamily,
    marginLeft: 2,
  },
  emergencyHeaderGroup: {
    gap: 6,
    marginTop: 8,
  },
  sectionHeader: {
    ...typography.title,
    fontFamily: typography.title.fontFamily,
  },
  emergencyHint: {
    ...typography.caption,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
