import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
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
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';

const PROFILE_IMAGE_KEY = '@taravelis_profile_image';

function MenuItem({
  icon,
  label,
  onPress,
  destructive = false,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  value?: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIcon}>
        <Feather name={icon} size={18} color={destructive ? colors.destructive : colors.foreground} />
      </View>
      <Text style={[styles.menuLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      {value && <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text>}
      {!destructive && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user, driverProfile, logout, switchMode } = useAuth();
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(PROFILE_IMAGE_KEY).then(uri => {
        if (active) setProfileImage(uri);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const handleSwitchToDriver = () => {
    if (!driverProfile) {
      router.push('/driver-onboarding');
    } else {
      Alert.alert('Switch to Driver Mode', 'Switch to driver dashboard?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await switchMode('driver');
            router.replace('/(driver)');
          },
        },
      ]);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'KR';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <GlassHeader title="Profile" showBack={false} />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 20,
        }}
      >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profileImage ? (
          <Image source={{ uri: profileImage }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Feather name="user" size={42} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.phone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
        {user?.email && (
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user.email}</Text>
        )}
      </View>

      {/* Join as Driver banner */}
      {!driverProfile && (
        <TouchableOpacity
          style={[styles.driverBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
          onPress={handleSwitchToDriver}
          activeOpacity={0.85}
        >
          <Feather name="zap" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.primary }]}>Join as Driver</Text>
            <Text style={[styles.bannerDesc, { color: colors.mutedForeground }]}>
              Earn money driving on Taravelis
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Switch mode if already a driver */}
      {driverProfile && (
        <TouchableOpacity
          style={[styles.switchDriverButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSwitchToDriver}
          activeOpacity={0.75}
        >
          <View style={styles.switchDriverIcon}>
            <Feather name="navigation" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.switchDriverText, { color: colors.foreground }]}>Switch to Driver Mode</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* Menu */}
      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem icon="user" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
        <MenuItem icon="credit-card" label="Payment Methods" onPress={() => router.push('/payment-methods')} />
        <MenuItem icon="phone" label="Phone" onPress={() => {}} value={user?.phone} />
        <MenuItem icon="shield" label="Privacy & Security" onPress={() => router.push('/privacy-security')} />
        <MenuItem icon="help-circle" label="Help & Support" onPress={() => router.push('/help-support')} />
        <MenuItem icon="info" label="About Taravelis" onPress={() => router.push('/about')} />
      </View>

      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="log-out"
          label="Log Out"
          onPress={handleLogout}
          destructive
        />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>Taravelis v1.0.0</Text>
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 6 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
  },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  phone: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  email: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  bannerTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  bannerDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  switchDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  switchDriverIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchDriverText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  menuSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  menuValue: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
});
