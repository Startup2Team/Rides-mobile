import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
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
import { useRide } from '@/context/RideContext';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const { rideHistory, loadHistory } = useRide();
  const activePackage = getActivePackageActivation(entitlement);
  const vehicles = getDriverVehicles(driverProfile);
  const vehicleCounts = getDriverVehicleStatusCounts(driverProfile);
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const { profileImage, setProfileImage, handleImagePick, handleDeletePhoto } = useProfilePhotoActions(driverProfile?.profileImage);
  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const completedRides = rideHistory.filter(ride => ride.driverId === user?.id && ride.status === 'completed');
  const totalDistance = completedRides.reduce((sum, ride) => sum + (ride.distance || 0), 0);
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
  const nameParts = user?.name ? user.name.trim().split(/\s+/) : [];
  const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase() : '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <View style={{ paddingTop: insets.top + 16, backgroundColor: pageBackground }}>
        <View style={styles.avatarSection}>
          <View style={styles.profileInfoContainer}>
            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.7}
              style={styles.nameContainer}
              accessibilityRole="button"
              accessibilityLabel="Edit profile details"
            >
              {lastName ? (
                <>
                  <AppText
                    style={[styles.nameFirst, { color: colors.foreground }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {firstName}
                  </AppText>
                  <View style={styles.nameRow}>
                    <AppText
                      style={[styles.nameLast, { color: colors.foreground }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {lastName}
                    </AppText>
                    {driverProfile?.isVerified === true ? <VerifiedBadge size={24} /> : null}
                  </View>
                </>
              ) : (
                <View style={styles.nameRow}>
                  <AppText
                    style={[styles.nameFirst, { color: colors.foreground }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {firstName}
                  </AppText>
                  {driverProfile?.isVerified === true ? <VerifiedBadge size={24} /> : null}
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <View style={styles.ratingGroup}>
                  <FontAwesome name="star" size={10} color={colors.primary} style={{ marginRight: 3 }} />
                  <AppText style={[styles.statHeaderVal, { color: colors.foreground }]}>
                    {ratingSummary.averageRating?.toFixed(1) ?? '5.0'}
                  </AppText>
                </View>
                <AppText style={[styles.statHeaderLabel, { color: colors.mutedForeground }]}>Rating</AppText>
              </View>

              <View style={styles.statColumn}>
                <AppText style={[styles.statHeaderVal, { color: colors.foreground }]}>
                  {driverProfile?.completedRides ?? 0}
                </AppText>
                <AppText style={[styles.statHeaderLabel, { color: colors.mutedForeground }]}>Trips</AppText>
              </View>

              <View style={styles.statColumn}>
                <AppText style={[styles.statHeaderVal, { color: colors.foreground }]}>
                  {totalDistance.toFixed(1)} km
                </AppText>
                <AppText style={[styles.statHeaderLabel, { color: colors.mutedForeground }]}>Distance</AppText>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (profileImage) {
                setIsPreviewVisible(true);
              } else {
                setShowPhotoSheet(true);
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={profileImage ? "Preview profile image" : "Upload profile image"}
          >
            <View style={styles.avatarContainer}>
              <View style={styles.avatarInner}>
                <LinearGradient colors={['#69A8F7', '#6674D8']} style={styles.avatarGradient} />
                <AppText style={styles.avatarInitial}>{profileInitial}</AppText>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatarImageAbsolute} />
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: TAB_BAR_SCREEN_BOTTOM_PADDING,
          paddingHorizontal: 16,
          gap: 22,
        }}
      >
        <View style={styles.section}>
          <SectionTitle title="My Vehicles" />
          <TouchableOpacity
            style={[styles.vehicleSummaryCard, styles.cardShadow, { backgroundColor: cardFill }]}
            onPress={() => router.push('/driver-vehicles')}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Open my vehicles"
          >
            <Feather name="truck" size={20} color={colors.primary} />
            <View style={styles.vehicleSummaryCopy}>
              <AppText style={[styles.vehicleSummaryTitle, { color: colors.foreground }]}>
                {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} linked
              </AppText>
              <AppText style={[styles.vehicleSummaryDetail, { color: colors.mutedForeground }]}>
                Approved {vehicleCounts.approved} • Pending {vehicleCounts.pendingReview} • Rejected {vehicleCounts.rejected}
              </AppText>
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
            <Feather name="layers" size={20} color={colors.primary} />
            <View style={styles.packageCopy}>
              <View style={styles.packageTitleRow}>
                <AppText style={[styles.packageTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {isEntitlementLoading ? 'Checking ride package...' : activePackage?.packageName ?? 'No active package'}
                </AppText>
                {!isEntitlementLoading && activePackage ? (
                  <View style={[styles.packageStatus, { backgroundColor: colors.successHex + '16' }]}>
                    <AppText style={[styles.packageStatusText, { color: colors.successHex }]}>Active</AppText>
                  </View>
                ) : null}
              </View>
              <AppText style={[styles.packageSubtext, { color: colors.mutedForeground }]}>
                {isEntitlementLoading ? 'Loading package details...' : activePackage ? 'Manage package' : 'Explore available packages'}
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Account" />
          <View style={[styles.groupedSection, styles.cardShadow, { backgroundColor: cardFill }]}>
            <MenuItem colors={colors} iconFamily="feather" icon="user" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
            <MenuItem colors={colors} iconFamily="feather" icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
            <MenuItem colors={colors} iconFamily="feather" icon="shield" label="Privacy and Security" onPress={() => router.push('/privacy-security')} />
            <MenuItem colors={colors} iconFamily="feather" icon="help-circle" label="Help and Support" onPress={() => router.push('/help-support')} />
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
              <AppText style={[styles.modeTitle, { color: colors.foreground }]}>Switch to Customer Mode</AppText>
              <AppText style={[styles.modeDescription, { color: colors.mutedForeground }]}>Book rides using your customer account</AppText>
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

        <AppText style={[styles.version, { color: colors.mutedForeground }]}>{APP_NAME} v1.0.0</AppText>
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
  return <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</AppText>;
}

// QuickStat deleted


function MenuItem({ colors, detail, iconFamily = 'mci', icon, label, last = false, onPress }: {
  colors: ReturnType<typeof useColors>; detail?: string; iconFamily?: 'feather' | 'mci' | 'symbol'; icon: keyof typeof Feather.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap; label: string; last?: boolean; onPress: () => void;
}) {
  return <>
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.62} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.menuIcon}>
        {iconFamily === 'symbol' ? (
          <SymbolView name="square.and.arrow.up" tintColor={colors.primary} size={20} />
        ) : iconFamily === 'feather' ? (
          <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={colors.primary} />
        ) : (
          <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.menuCopy}>
        <AppText style={[styles.menuLabel, { color: colors.foreground }]}>{label}</AppText>
        {detail ? <AppText style={[styles.menuDetail, { color: colors.mutedForeground }]}>{detail}</AppText> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
    {!last ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  profileInfoContainer: {
    flex: 1,
    gap: 8,
  },
  nameContainer: {
    gap: 0,
  },
  nameFirst: {
    ...typography.displayXL,
    lineHeight: 38,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  nameLast: {
    ...typography.displayXL,
    lineHeight: 38,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 32,
    marginTop: 2,
  },
  statColumn: {
    alignItems: 'center',
    gap: 0,
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statHeaderVal: {
    ...typography.label,
  },
  statHeaderLabel: {
    ...typography.tiny,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.16)' },
    }),
  },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.displayXL,
    color: '#FFFFFF',
    lineHeight: 42,
  },
  avatarImageAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', minWidth: 0, flexShrink: 1 },
  phone: { ...typography.label,  },
  section: { gap: 10 },
  sectionTitle: { ...typography.title, letterSpacing: -0.2, marginLeft: 2 },
  cardShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3,
    ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }),
  },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
  packageCopy: { flex: 1, gap: 3 },
  packageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  packageTitle: { flexShrink: 1, ...typography.body,  },
  packageSubtext: { ...typography.tiny,  },
  packageStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  packageStatusText: { ...typography.tiny,  },
  vehicleSummaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
  vehicleSummaryCopy: { flex: 1, gap: 3 },
  vehicleSummaryTitle: { ...typography.body,  },
  vehicleSummaryDetail: { ...typography.tiny,  },
  groupedSection: { borderRadius: 20, overflow: 'hidden' },

  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 20, paddingVertical: 16 },
  menuIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 2 },
  menuLabel: { ...typography.title, lineHeight: 22 },
  menuDetail: { ...typography.tiny, lineHeight: 16 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, padding: 16 },
  modeCopy: { flex: 1, gap: 3 },
  modeTitle: { ...typography.body,  },
  modeDescription: { ...typography.tiny,  },
  version: { textAlign: 'center', ...typography.caption, paddingVertical: 8 },
});
