import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { APP_NAME } from '@/constants/branding';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';
import { getShareRouteForMode } from '@/navigation/shareNavigation';
import { canAccessDriverMode, getDriverApplicationAction } from '@/utils/driverVerification';
import { leaveRidesFeedback, rateRides } from '@/utils/communityActions';
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import { ImageGalleryPreview } from '@/components/ImageGalleryPreview';
import { useProfilePhotoActions } from '@/hooks/useProfilePhotoActions';
import { ProfilePhotoEditSheet } from '@/components/ProfilePhotoEditSheet';


function MenuItem({
  iconFamily = 'feather',
  icon,
  label,
  onPress,
  destructive = false,
  detail,
  showSeparator = true,
  separatorColor,
}: {
  iconFamily?: 'feather' | 'mci' | 'symbol';
  icon: keyof typeof Feather.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  detail?: string;
  showSeparator?: boolean;
  separatorColor: string;
}) {
  const colors = useColors();
  return (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.menuIcon}>
          {iconFamily === 'symbol' ? (
            <SymbolView
              name="square.and.arrow.up"
              tintColor={destructive ? colors.destructive : colors.primary}
              size={20}
            />
          ) : iconFamily === 'feather' ? (
            <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={destructive ? colors.destructive : colors.primary} />
          ) : (
            <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={destructive ? colors.destructive : colors.primary} />
          )}
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
          {detail ? <Text style={[styles.menuDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
        </View>
        {!destructive && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />}
      </TouchableOpacity>
      {showSeparator && <View style={[styles.separator, { backgroundColor: separatorColor }]} />}
    </>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { profileImage, setProfileImage, handleImagePick, handleDeletePhoto } = useProfilePhotoActions();
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  /** iOS grouped inset list — elevated fill, no card outline */
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const separatorColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const pageBackground = isDark ? '#000000' : '#F2F2F7';
  const profileInitial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const nameParts = user?.name ? user.name.trim().split(/\s+/) : [];
  const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase() : '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase();
  const driverAction = getDriverApplicationAction(driverProfile);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data);
      });
      return () => {
        active = false;
      };
    }, [setProfileImage]),
  );

  const handleSwitchToDriver = () => {
    if (canAccessDriverMode(driverProfile)) {
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
      return;
    }
    router.push(driverAction.route);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
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

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <OfflineBanner />
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
              <Text
                style={[styles.nameFirst, { color: colors.foreground }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {firstName}
              </Text>
              {lastName ? (
                <Text
                  style={[styles.nameLast, { color: colors.foreground }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {lastName}
                </Text>
              ) : null}
            </TouchableOpacity>

            <View style={styles.ratingBadge}>
              <FontAwesome name="star" size={12} color={colors.primary} />
              <Text style={[styles.ratingText, { color: colors.foreground }]}>5.0</Text>
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
            {profileImage ? (
              <View style={styles.avatarImageShadow}>
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              </View>
            ) : (
              <LinearGradient colors={['#9DBBE0', '#7984C3']} style={styles.avatar}>
                <Text style={styles.avatarInitial}>{profileInitial}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <GlassScrollView
        indicatorTop={0}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: TAB_BAR_SCREEN_BOTTOM_PADDING,
        }}
      >

      {!canAccessDriverMode(driverProfile) && (
        <TouchableOpacity
          style={[styles.driverBanner, { backgroundColor: cardFill }]}
          onPress={handleSwitchToDriver}
          activeOpacity={0.6}
        >
          <View style={styles.driverBannerIcon}>
            <MaterialCommunityIcons name="steering" size={25} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>{driverAction.label}</Text>
            <Text style={[styles.bannerDesc, { color: colors.mutedForeground }]}>
              {driverAction.label === 'In Review' ? 'Review usually takes not too long' : `Earn money driving on ${APP_NAME}`}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {canAccessDriverMode(driverProfile) && (
        <View style={[styles.menuSection, { backgroundColor: cardFill, marginHorizontal: 16, marginBottom: 20 }]}>
          <MenuItem
            iconFamily="mci"
            icon="swap-horizontal"
            label="Switch to Driver Mode"
            onPress={handleSwitchToDriver}
            showSeparator={false}
            separatorColor={separatorColor}
          />
        </View>
      )}

      <View style={styles.sectionGroup}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
        <View style={[styles.menuSection, { backgroundColor: cardFill }]}>
          <MenuItem
            iconFamily="feather"
            icon="user"
            label="Edit Profile"
            onPress={() => router.push('/edit-profile')}
            separatorColor={separatorColor}
          />
          <MenuItem
          iconFamily="feather"
          icon="shield"
          label="Privacy & Security"
          onPress={() => router.push('/privacy-security')}
          separatorColor={separatorColor}
        />
        <MenuItem
          iconFamily="feather"
          icon="help-circle"
          label="Help & Support"
          onPress={() => router.push('/help-support')}
          separatorColor={separatorColor}
        />
        <MenuItem
          iconFamily="feather"
          icon="alert-triangle"
          label="Report a Ride Issue"
          detail="Driver behavior, lost items, payment, or safety concerns"
          onPress={() => router.push('/report-ride-issue')}
          separatorColor={separatorColor}
        />
        <MenuItem
          iconFamily="mci"
          icon="information-outline"
          label={`About ${APP_NAME}`}
          onPress={() => router.push('/about')}
          separatorColor={separatorColor}
        />
        <MenuItem
          icon="settings"
          label="Settings"
          onPress={() => router.push('/settings')}
          showSeparator={false}
          separatorColor={separatorColor}
        />
        </View>
      </View>

      <View style={styles.sectionGroup}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Community</Text>
        <View style={[styles.menuSection, { backgroundColor: cardFill }]}>
          <MenuItem
            iconFamily="feather"
            icon="star"
            label={`Rate ${APP_NAME}`}
            detail="Enjoying the app? Take a moment to rate it and share your feedback."
            onPress={() => { void rateRides(); }}
            separatorColor={separatorColor}
          />
          <MenuItem
            iconFamily="mci"
            icon="message-text"
            label="Leave Feedback"
            detail="We'd love to hear from you."
            onPress={() => { void leaveRidesFeedback(); }}
            separatorColor={separatorColor}
          />
          <MenuItem
            iconFamily="symbol"
            icon="share-2"
            label="Share the App"
            detail={`Invite friends and family to experience ${APP_NAME}.`}
            onPress={() => router.push(getShareRouteForMode(user?.mode))}
            showSeparator={false}
            separatorColor={separatorColor}
          />
        </View>
      </View>

      <View style={styles.sectionGroup}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Actions</Text>
        <View style={[styles.menuSection, { backgroundColor: cardFill }]}>
        <MenuItem
          iconFamily="feather"
          icon="log-out"
          label="Log Out"
          onPress={handleLogout}
          showSeparator={false}
          separatorColor={separatorColor}
        />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8FA8D4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.12)' },
    }),
  },
  avatarInitial: { fontSize: 36, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', lineHeight: 42 },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarImageShadow: {
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
  profileInfoContainer: {
    flex: 1,
    gap: 8,
  },
  nameContainer: {
    gap: 0,
  },
  nameFirst: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    lineHeight: 38,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  nameLast: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    lineHeight: 38,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  contactDetails: {
    marginTop: 4,
    gap: 2,
  },
  phone: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  email: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 14,
    gap: 14,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  driverBannerIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  bannerDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sectionGroup: { gap: 10, marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginLeft: 2 },
  menuSection: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  menuIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 17, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  menuDetail: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
});
