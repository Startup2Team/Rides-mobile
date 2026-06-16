import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { VEHICLE_LABELS } from '@/types';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { formatDriverRatingSummary, getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { DRIVER_RIDE_PACKAGES } from '@/domain/driverRidePackages';
import { APP_NAME } from '@/constants/branding';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';
import { leaveRidesFeedback, rateRides, shareRides } from '@/utils/communityActions';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [profileImage, setProfileImage] = React.useState<string | null>(null);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const pageBackground = isDark ? '#000000' : '#F2F2F7';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data ?? driverProfile?.profileImage ?? null);
      });
      return () => {
        active = false;
      };
    }, [driverProfile?.profileImage]),
  );

  React.useEffect(() => {
    let cancelled = false;
    async function loadRatingSummary() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id ? getDriverRatingSummary(stored.data ?? [], user.id) : EMPTY_RATING_SUMMARY;
      if (!cancelled) setRatingSummary(summary);
    }
    void loadRatingSummary();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSwitchToCustomer = () => {
    Alert.alert('Switch Mode', 'Switch to customer mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          try {
            await switchMode('customer');
            router.replace('/(tabs)');
          } catch {
            // switchMode('customer') is local-only and should never throw,
            // but guard anyway to prevent unhandled rejections.
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: logout },
    ]);
  };

  const profileInitial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <GlassHeader title="Profile" subtitle="Driver account and preferences" showBack={false} />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 24,
          paddingHorizontal: 16,
          gap: 22,
        }}
      >
        <TouchableOpacity
          style={styles.identitySection}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <View style={styles.avatarWrap}>
            {profileImage ? (
              <View style={styles.avatarImageShadow}>
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              </View>
            ) : (
              <LinearGradient colors={['#69A8F7', '#6674D8']} style={styles.avatar}>
                <Text style={styles.avatarInitial}>{profileInitial}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{user?.name}</Text>
            {driverProfile?.isVerified === true ? <VerifiedBadge /> : null}
          </View>
          <Text style={[styles.phone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
        </TouchableOpacity>

        <View style={[styles.quickStats, styles.cardShadow, { backgroundColor: cardFill }]}>
          <QuickStat colors={colors} label="Driver Rating" value={formatDriverRatingSummary(ratingSummary)} />
          <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
          <QuickStat colors={colors} label="Completed Trips" value={String(driverProfile?.completedRides ?? 0)} />
          <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
          <QuickStat colors={colors} label="Credits Left" value={isEntitlementLoading ? '...' : String(rideCredits)} />
        </View>

        <View style={styles.section}>
          <SectionTitle title={activePackage ? 'Active Ride Package' : 'Ride Package'} />
          <TouchableOpacity
            style={[styles.packageCard, styles.cardShadow, { backgroundColor: cardFill }]}
            onPress={() => router.push('/driver-packages')}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={activePackage ? 'Manage active ride package' : 'Explore ride packages'}
          >
            <Feather name="layers" size={20} color={colors.foreground} />
            <View style={styles.packageCopy}>
              <View style={styles.packageTitleRow}>
                <Text style={[styles.packageTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {isEntitlementLoading ? 'Checking ride package...' : activePackage?.name ?? 'No active package'}
                </Text>
                {!isEntitlementLoading && activePackage ? (
                  <View style={[styles.packageStatus, { backgroundColor: colors.successHex + '16' }]}>
                    <Text style={[styles.packageStatusText, { color: colors.successHex }]}>Active</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.packageSubtext, { color: colors.mutedForeground }]}>
                {isEntitlementLoading ? 'Loading package details...' : activePackage ? 'Manage package' : 'Explore available packages'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {driverProfile ? (
          <View style={styles.section}>
            <SectionTitle title="Driver Details" />
            <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
              <InfoRow colors={colors} icon="truck" label="Vehicle" value={VEHICLE_LABELS[driverProfile.vehicleType]} />
              <InfoRow colors={colors} icon="hash" label="Plate Number" value={driverProfile.plateNumber} />
              <InfoRow colors={colors} icon="credit-card" label="License" value={driverProfile.licenseNumber} />
              <InfoRow colors={colors} icon="map-pin" label="City" value={driverProfile.city ?? driverProfile.province} />
              <InfoRow colors={colors} icon="smartphone" label="Mobile Money Details" value={driverProfile.momoCode} last />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="Account" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
            <MenuItem colors={colors} icon="edit-2" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
            <MenuItem colors={colors} icon="file-text" label="Driver Documents" onPress={() => router.push('/driver-documents')} />
            <MenuItem colors={colors} icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
            <MenuItem colors={colors} icon="shield" label="Privacy & Security" onPress={() => router.push('/privacy-security')} />
            <MenuItem colors={colors} icon="help-circle" label="Help & Support" onPress={() => router.push('/help-support')} />
            <MenuItem colors={colors} icon="info" label={`About ${APP_NAME}`} onPress={() => router.push('/about')} />
            <MenuItem colors={colors} icon="settings" label="Settings" onPress={() => router.push('/settings')} last />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Mode" />
          <TouchableOpacity
            style={[styles.modeCard, styles.cardShadow, { backgroundColor: cardFill }]}
            onPress={handleSwitchToCustomer}
            activeOpacity={0.72}
          >
            <Feather name="repeat" size={20} color={colors.foreground} />
            <View style={styles.modeCopy}>
              <Text style={[styles.modeTitle, { color: colors.foreground }]}>Switch to Customer Mode</Text>
              <Text style={[styles.modeDescription, { color: colors.mutedForeground }]}>Book rides using your customer account</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Community" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
            <MenuItem colors={colors} icon="star" label={`Rate ${APP_NAME}`} detail="Enjoying the app? Take a moment to rate it and share your feedback." onPress={() => { void rateRides(); }} />
            <MenuItem colors={colors} icon="message-square" label="Leave Feedback" detail="We'd love to hear from you." onPress={() => { void leaveRidesFeedback(); }} />
            <MenuItem colors={colors} icon="share-2" label="Share the App" detail={`Invite friends and family to experience ${APP_NAME}.`} onPress={() => { void shareRides(); }} last />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Actions" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.65}>
            <Feather name="log-out" size={18} color={colors.foreground} />
            <Text style={[styles.logoutText, { color: colors.foreground }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>{APP_NAME} v1.0.0</Text>
      </GlassScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function QuickStat({ colors, label, value }: { colors: ReturnType<typeof useColors>; label: string; value: string }) {
  return <View style={styles.quickStat}>
    <Text style={[styles.quickStatValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={[styles.quickStatLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
  </View>;
}

function InfoRow({ colors, icon, label, last = false, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof Feather.glyphMap; label: string; last?: boolean; value?: string;
}) {
  return <>
    <View style={styles.infoRow}>
      <Feather name={icon} size={17} color={colors.foreground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
    {!last ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
  </>;
}

function MenuItem({ colors, detail, icon, label, last = false, onPress }: {
  colors: ReturnType<typeof useColors>; detail?: string; icon: keyof typeof Feather.glyphMap; label: string; last?: boolean; onPress: () => void;
}) {
  return <>
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.62} accessibilityRole="button" accessibilityLabel={label}>
      <Feather name={icon} size={19} color={colors.foreground} />
      <View style={styles.menuCopy}>
        <Text style={[styles.menuText, { color: colors.foreground }]}>{label}</Text>
        {detail ? <Text style={[styles.menuDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
    {!last ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  identitySection: { alignItems: 'center', gap: 5, paddingTop: 2 },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 5,
  },
  avatarInitial: { fontSize: 43, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', lineHeight: 50 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarImageShadow: {
    borderRadius: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 5,
  },
  name: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, maxWidth: '90%' },
  phone: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginLeft: 2 },
  cardShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3,
    ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }),
  },
  quickStats: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 8 },
  quickStat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  quickStatValue: { maxWidth: '100%', fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  quickStatLabel: { maxWidth: '100%', fontSize: 9, fontFamily: 'Inter_500Medium' },
  verticalDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
  packageCopy: { flex: 1, gap: 3 },
  packageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  packageTitle: { flexShrink: 1, fontSize: 15, fontFamily: 'Inter_700Bold' },
  packageSubtext: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  packageStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  packageStatusText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  groupedSection: { borderRadius: 20, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 50, paddingHorizontal: 16, paddingVertical: 12 },
  infoLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  infoValue: { maxWidth: '48%', textAlign: 'right', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 44 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 54, paddingHorizontal: 16, paddingVertical: 14 },
  menuCopy: { flex: 1, gap: 2 },
  menuText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  menuDetail: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, padding: 16 },
  modeCopy: { flex: 1, gap: 3 },
  modeTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  modeDescription: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 16 },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
});
