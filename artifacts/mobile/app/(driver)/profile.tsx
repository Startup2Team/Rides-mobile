import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { formatDriverRatingSummary, getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { getActivePackageActivation } from '@/domain/driverRidePackages';
import { getDriverVehicleStatusCounts, getDriverVehicles } from '@/domain/driverVehicles';
import { APP_NAME } from '@/constants/branding';
import { getShareRouteForMode } from '@/navigation/shareNavigation';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';
import { leaveRidesFeedback, rateRides } from '@/utils/communityActions';
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import { ImageGalleryPreview } from '@/components/ImageGalleryPreview';
import { useProfilePhotoActions } from '@/hooks/useProfilePhotoActions';
import { ProfilePhotoEditSheet } from '@/components/ProfilePhotoEditSheet';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const activePackage = getActivePackageActivation(entitlement);
  const vehicles = getDriverVehicles(driverProfile);
  const vehicleCounts = getDriverVehicleStatusCounts(driverProfile);
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const { profileImage, setProfileImage, handleImagePick, handleDeletePhoto } = useProfilePhotoActions(driverProfile?.profileImage);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = React.useState(false);
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
    }, [driverProfile?.profileImage, setProfileImage]),
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
          await switchMode('customer');
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
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
          paddingBottom: TAB_BAR_SCREEN_BOTTOM_PADDING,
          paddingHorizontal: 16,
          gap: 22,
        }}
      >
        <View style={styles.identitySection}>
          <TouchableOpacity
            onPress={() => {
              if (profileImage) {
                setIsPreviewVisible(true);
              } else {
                setShowPhotoSheet(true);
              }
            }}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={profileImage ? "Preview profile image" : "Upload profile image"}
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
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.72}
            style={{ alignItems: 'center', gap: 5 }}
            accessibilityRole="button"
            accessibilityLabel="Edit profile details"
          >
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{user?.name}</Text>
              {driverProfile?.isVerified === true ? <VerifiedBadge /> : null}
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickStats, styles.cardShadow, { backgroundColor: cardFill }]}>
          <QuickStat colors={colors} label="Driver Rating" value={formatDriverRatingSummary(ratingSummary)} />
          <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
          <QuickStat colors={colors} label="Completed Trips" value={String(driverProfile?.completedRides ?? 0)} />
          <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
          <QuickStat
            colors={colors}
            label="Rides"
            value={isEntitlementLoading ? '...' : String(rideCredits)}
            onPress={() => router.push('/driver-packages')}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle title="My Vehicles" />
          <TouchableOpacity
            style={[styles.vehicleSummaryCard, styles.cardShadow, { backgroundColor: cardFill }]}
            onPress={() => router.push('/driver-vehicles')}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Open my vehicles"
          >
            <MaterialCommunityIcons name="truck" size={20} color={colors.primary} />
            <View style={styles.vehicleSummaryCopy}>
              <Text style={[styles.vehicleSummaryTitle, { color: colors.foreground }]}>
                {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} linked
              </Text>
              <Text style={[styles.vehicleSummaryDetail, { color: colors.mutedForeground }]}>
                Approved {vehicleCounts.approved} • Pending {vehicleCounts.pendingReview} • Rejected {vehicleCounts.rejected}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
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
            <MaterialCommunityIcons name="layers-triple" size={20} color={colors.primary} />
            <View style={styles.packageCopy}>
              <View style={styles.packageTitleRow}>
                <Text style={[styles.packageTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {isEntitlementLoading ? 'Checking ride package...' : activePackage?.packageName ?? 'No active package'}
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
              <InfoRow colors={colors} icon="star" label="Rating Summary" value={formatDriverRatingSummary(ratingSummary)} />
              <InfoRow colors={colors} icon="shield" label="Verification Status" value={driverProfile.verificationStatus === 'approved' && driverProfile.isVerified ? 'Verified' : driverProfile.verificationStatus === 'pending_review' ? 'Pending Review' : driverProfile.verificationStatus === 'rejected' ? 'Rejected' : 'Draft'} />
              <InfoRow colors={colors} icon="map-marker" label="Location" value={driverProfile.city ?? driverProfile.province} />
              <InfoRow colors={colors} icon="cellphone" label="Mobile Money Details" value={driverProfile.momoCode} last />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="Account" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
            <MenuItem colors={colors} iconFamily="feather" icon="user" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
            <MenuItem colors={colors} iconFamily="feather" icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
            <MenuItem colors={colors} iconFamily="feather" icon="shield" label="Privacy & Security" onPress={() => router.push('/privacy-security')} />
            <MenuItem colors={colors} iconFamily="feather" icon="help-circle" label="Help & Support" onPress={() => router.push('/help-support')} />
            <MenuItem colors={colors} iconFamily="mci" icon="information-outline" label={`About ${APP_NAME}`} onPress={() => router.push('/about')} />
            <MenuItem colors={colors} iconFamily="feather" icon="settings" label="Settings" onPress={() => router.push('/settings')} last />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Mode" />
          <TouchableOpacity
            style={[styles.modeCard, styles.cardShadow, { backgroundColor: cardFill }]}
            onPress={handleSwitchToCustomer}
            activeOpacity={0.72}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.primary} />
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
            <MenuItem colors={colors} iconFamily="feather" icon="star" label={`Rate ${APP_NAME}`} detail="Enjoying the app? Take a moment to rate it and share your feedback." onPress={() => { void rateRides(); }} />
            <MenuItem colors={colors} iconFamily="mci" icon="message-text" label="Leave Feedback" detail="We'd love to hear from you." onPress={() => { void leaveRidesFeedback(); }} />
            <MenuItem colors={colors} iconFamily="symbol" icon="share-2" label="Share the App" detail={`Invite friends and family to experience ${APP_NAME}.`} onPress={() => router.push(getShareRouteForMode(user?.mode))} last />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Actions" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
            <MenuItem colors={colors} iconFamily="feather" icon="log-out" label="Log Out" onPress={handleLogout} last />
          </View>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>{APP_NAME} v1.0.0</Text>
      </GlassScrollView>

      {profileImage && (
        <ImageGalleryPreview
          images={[{ id: 'profile-img', uri: profileImage, title: 'Profile picture' }]}
          initialIndex={0}
          visible={isPreviewVisible}
          onClose={() => setIsPreviewVisible(false)}
          rightActionLabel="Edit"
          editMenu={{
            title: 'Edit profile picture',
            avatarUri: profileImage,
            options: [
              {
                label: 'Take photo',
                icon: 'camera',
                onPress: async () => {
                  const uri = await handleImagePick('camera');
                  if (uri) setIsPreviewVisible(false);
                },
              },
              {
                label: 'Choose photo',
                icon: 'image',
                onPress: async () => {
                  const uri = await handleImagePick('gallery');
                  if (uri) setIsPreviewVisible(false);
                },
              },
              {
                label: 'Delete photo',
                icon: 'trash-2',
                destructive: true,
                onPress: async () => {
                  await handleDeletePhoto();
                  setIsPreviewVisible(false);
                },
              },
            ],
          }}
        />
      )}

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
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function QuickStat({ colors, label, onPress, value }: {
  colors: ReturnType<typeof useColors>; label: string; onPress?: () => void; value: string;
}) {
  const content = <>
    <Text style={[styles.quickStatValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={[styles.quickStatLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
  </>;

  if (onPress) {
    return <TouchableOpacity
      style={styles.quickStat}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`View ${label.toLowerCase()}`}
    >
      {content}
    </TouchableOpacity>;
  }

  return <View style={styles.quickStat}>{content}</View>;
}

function InfoRow({ colors, icon, label, last = false, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; last?: boolean; value?: string;
}) {
  return <>
    <View style={styles.infoRow}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
    {!last ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
  </>;
}

function MenuItem({ colors, detail, iconFamily = 'mci', icon, label, last = false, onPress }: {
  colors: ReturnType<typeof useColors>; detail?: string; iconFamily?: 'feather' | 'mci' | 'symbol'; icon: keyof typeof Feather.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap; label: string; last?: boolean; onPress: () => void;
}) {
  return <>
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.62} accessibilityRole="button" accessibilityLabel={label}>
      {iconFamily === 'symbol' ? (
        <SymbolView name="square.and.arrow.up" tintColor={colors.primary} size={20} />
      ) : iconFamily === 'feather' ? (
        <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={colors.primary} />
      ) : (
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={colors.primary} />
      )}
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
  name: { fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, maxWidth: '90%', minWidth: 0 },
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
  vehicleSummaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
  vehicleSummaryCopy: { flex: 1, gap: 3 },
  vehicleSummaryTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  vehicleSummaryDetail: { fontSize: 11, fontFamily: 'Inter_400Regular' },
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
