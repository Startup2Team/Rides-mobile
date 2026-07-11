import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Feather,
  MaterialCommunityIcons,
  FontAwesome,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { GlassScrollView } from "@/components/GlassScrollView";
import { useColors } from "@/hooks/useColors";
import { OfflineBanner } from "@/components/OfflineBanner";
import { APP_NAME } from "@/constants/branding";
import { getShareRouteForMode } from "@/navigation/shareNavigation";
import { getRatingInformationRoute } from "@/navigation/ratingNavigation";
import {
  canAccessDriverMode,
  getDriverApplicationAction,
} from "@/utils/driverVerification";
import { leaveRidesFeedback, rateRides } from "@/utils/communityActions";
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from "@/constants/tabBar";
import { ImageGalleryPreview } from "@/components/ImageGalleryPreview";
import { PrivacySecurityIcon } from "@/components/PrivacySecurityIcon";
import { HelpSupportIcon } from "@/components/HelpSupportIcon";
import { AboutRidesIcon } from "@/components/AboutRidesIcon";
import { SwitchModeIcon } from "@/components/SwitchModeIcon";
import { ReportIssueIcon } from "@/components/ReportIssueIcon";
import { EditProfileIcon } from "@/components/EditProfileIcon";
import { useProfile } from "@/domains/profile";
import { useProfilePhotoActions } from "@/hooks/useProfilePhotoActions";
import { ProfilePhotoEditSheet } from "@/components/ProfilePhotoEditSheet";
import { AppText } from "@/components/AppText";
import { elevation } from "@/constants/elevation";
import { icons } from "@/constants/icons";
import { radius } from "@/constants/radius";
import { prefetchRatingInformationImages } from "@/constants/ratingInformationImages";
import { sizes } from "@/constants/sizes";
import { spacing, semanticSpacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { navigateToDriverHomeAfterCompletion } from "@/navigation/navigationPolicy";
import { usePressGuard } from "@/hooks/usePressGuard";

function MenuItem({
  iconFamily = "feather",
  icon,
  label,
  onPress,
  destructive = false,
  detail,
  showSeparator = true,
  separatorColor,
}: {
  iconFamily?: "feather" | "mci" | "symbol";
  icon:
    | keyof typeof Feather.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap
    | React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  detail?: string;
  showSeparator?: boolean;
  separatorColor: string;
}) {
  const colors = useColors();
  const guardedPress = usePressGuard(onPress);
  return (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={guardedPress}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.menuIcon}>
          {React.isValidElement(icon) ? (
            icon
          ) : iconFamily === "symbol" ? (
            <SymbolView
              name="square.and.arrow.up"
              tintColor={destructive ? colors.destructive : colors.primary}
              size={icons.size.lg}
            />
          ) : iconFamily === "feather" ? (
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={icons.size.lg}
              color={destructive ? colors.destructive : colors.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={icons.size.lg}
              color={destructive ? colors.destructive : colors.primary}
            />
          )}
        </View>
        <View style={styles.menuCopy}>
          <AppText
            variant="body"
            style={[
              styles.menuLabel,
              { color: destructive ? colors.destructive : colors.foreground },
            ]}
          >
            {label}
          </AppText>
          {detail ? (
            <AppText
              variant="tiny"
              style={[styles.menuDetail, { color: colors.mutedForeground }]}
            >
              {detail}
            </AppText>
          ) : null}
        </View>
        {!destructive && (
          <Feather
            name="chevron-right"
            size={icons.semantic.row}
            color={colors.mutedForeground}
          />
        )}
      </TouchableOpacity>
      {showSeparator && (
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      )}
    </>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const { user, driverProfile, switchMode, profile } = useProfile();
  const { profileImage, handleImagePick, handleDeletePhoto } =
    useProfilePhotoActions();
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  /** iOS grouped inset list — elevated fill, no card outline */
  const cardFill = isDark ? "#1C1C1E" : "#FFFFFF";
  const separatorColor = isDark ? "rgba(84,84,88,0.65)" : "rgba(60,60,67,0.29)";
  const pageBackground = isDark ? "#000000" : "#F2F2F7";
  const profileInitial =
    profile?.fullName?.trim()?.[0]?.toUpperCase() ??
    user?.name?.trim()?.[0]?.toUpperCase() ??
    "?";
  const nameParts = profile?.fullName
    ? profile.fullName.trim().split(/\s+/)
    : user?.name
      ? user.name.trim().split(/\s+/)
      : [];
  const firstName = nameParts[0]
    ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase()
    : "";
  const lastName = nameParts.slice(1).join(" ").toUpperCase();
  const driverAction = getDriverApplicationAction(driverProfile);
  const handleEditProfile = usePressGuard(() => router.push("/edit-profile"));
  const handleRatingInfo = usePressGuard(() => {
    prefetchRatingInformationImages();
    router.push(getRatingInformationRoute(user?.mode) as never);
  });
  const handleSwitchToDriver = usePressGuard(() => {
    if (canAccessDriverMode(driverProfile)) {
      Alert.alert("Switch to Driver Mode", "Switch to driver dashboard?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            await switchMode("driver");
            navigateToDriverHomeAfterCompletion(router);
          },
        },
      ]);
      return;
    }
    router.push(driverAction.route);
  });

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <OfflineBanner />
      <View
        style={{
          paddingTop: insets.top + spacing[16],
          backgroundColor: pageBackground,
        }}
      >
        <View style={styles.avatarSection}>
          <View style={styles.profileInfoContainer}>
            <TouchableOpacity
              onPress={handleEditProfile}
              activeOpacity={0.7}
              style={styles.nameContainer}
              accessibilityRole="button"
              accessibilityLabel="Edit profile details"
            >
              <AppText
                variant="displayXL"
                style={[styles.nameFirst, { color: colors.foreground }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {firstName}
              </AppText>
              {lastName ? (
                <AppText
                  variant="displayXL"
                  style={[styles.nameLast, { color: colors.foreground }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {lastName}
                </AppText>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ratingBadge}
              onPress={handleRatingInfo}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Open rating information"
              accessibilityHint="Explains how your rating works"
              hitSlop={8}
            >
              <FontAwesome
                name="star"
                size={icons.size.xxs}
                color={colors.primary}
              />
              <AppText
                variant="label"
                style={[styles.ratingText, { color: colors.foreground }]}
              >
                5.0
              </AppText>
            </TouchableOpacity>
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
            accessibilityLabel={
              profileImage ? "Preview profile image" : "Upload profile image"
            }
          >
            <View style={styles.avatarContainer}>
              <View style={styles.avatarInner}>
                <LinearGradient
                  colors={["#9DBBE0", "#7984C3"]}
                  style={styles.avatarGradient}
                />
                <AppText variant="displayXL" style={styles.avatarInitial}>
                  {profileInitial}
                </AppText>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.avatarImageAbsolute}
                  />
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <GlassScrollView
        indicatorTop={spacing[8]}
        contentContainerStyle={{
          paddingTop: spacing[8],
          paddingBottom:
            insets.bottom + TAB_BAR_SCREEN_BOTTOM_PADDING + spacing[16],
        }}
      >
        {!canAccessDriverMode(driverProfile) && (
          <TouchableOpacity
            style={[styles.driverBanner, { backgroundColor: cardFill }]}
            onPress={handleSwitchToDriver}
            activeOpacity={0.6}
          >
            <View style={styles.driverBannerIcon}>
              <MaterialCommunityIcons
                name="steering"
                size={25}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                variant="title"
                style={[styles.bannerTitle, { color: colors.foreground }]}
              >
                {driverAction.label}
              </AppText>
              <AppText
                variant="label"
                style={[styles.bannerDesc, { color: colors.mutedForeground }]}
              >
                {driverAction.label === "In Review"
                  ? "Review usually takes not too long"
                  : `Earn money driving on ${APP_NAME}`}
              </AppText>
            </View>
            <Feather
              name="chevron-right"
              size={icons.semantic.row}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}

        {canAccessDriverMode(driverProfile) && (
          <View
            style={[
              styles.menuSection,
              {
                backgroundColor: cardFill,
                marginHorizontal: semanticSpacing.cardPadding,
                marginBottom: semanticSpacing.screenPadding,
              },
            ]}
          >
            <MenuItem
              icon={<SwitchModeIcon />}
              label="Switch to Driver Mode"
              onPress={handleSwitchToDriver}
              showSeparator={false}
              separatorColor={separatorColor}
            />
          </View>
        )}

        <View style={styles.sectionGroup}>
          <AppText
            variant="h3"
            style={[styles.sectionTitle, { color: colors.foreground }]}
          >
            Account
          </AppText>
          <View style={[styles.menuSection, { backgroundColor: cardFill }]}>
            <MenuItem
              icon={<EditProfileIcon />}
              label="Edit Profile"
              onPress={() => router.push("/edit-profile")}
              separatorColor={separatorColor}
            />
            <MenuItem
              icon={<PrivacySecurityIcon />}
              label="Privacy and Security"
              onPress={() => router.push("/privacy-security")}
              separatorColor={separatorColor}
            />
            <MenuItem
              icon={<HelpSupportIcon />}
              label="Help and Support"
              onPress={() => router.push("/help-support")}
              separatorColor={separatorColor}
            />
            <MenuItem
              icon={<ReportIssueIcon />}
              label="Report a Ride Issue"
              detail="Driver behavior, lost items, payment, or safety concerns"
              onPress={() => router.push("/report-ride-issue")}
              separatorColor={separatorColor}
            />
            <MenuItem
              icon={<AboutRidesIcon />}
              label={`About ${APP_NAME}`}
              onPress={() => router.push("/about")}
              separatorColor={separatorColor}
            />
            <MenuItem
              icon="settings"
              label="Settings"
              onPress={() => router.push("/settings")}
              showSeparator={false}
              separatorColor={separatorColor}
            />
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <AppText
            variant="h3"
            style={[styles.sectionTitle, { color: colors.foreground }]}
          >
            Community
          </AppText>
          <View style={[styles.menuSection, { backgroundColor: cardFill }]}>
            <MenuItem
              iconFamily="feather"
              icon="star"
              label={`Rate ${APP_NAME}`}
              detail="Enjoying the app? Take a moment to rate it and share your feedback."
              onPress={() => {
                void rateRides();
              }}
              separatorColor={separatorColor}
            />
            <MenuItem
              iconFamily="mci"
              icon="message-text"
              label="Leave Feedback"
              detail="We'd love to hear from you."
              onPress={() => {
                void leaveRidesFeedback();
              }}
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

        <AppText
          variant="caption"
          style={[styles.version, { color: colors.mutedForeground }]}
        >
          {APP_NAME} v1.0.0
        </AppText>
      </GlassScrollView>

      {profileImage && (
        <ImageGalleryPreview
          images={[
            { id: "profile-img", uri: profileImage, title: "Profile picture" },
          ]}
          initialIndex={0}
          visible={isPreviewVisible}
          onClose={() => setIsPreviewVisible(false)}
          rightActionLabel="Edit"
          editMenu={{
            title: "Edit profile picture",
            avatarUri: profileImage,
            options: [
              {
                label: "Take photo",
                icon: "camera",
                onPress: async () => {
                  const uri = await handleImagePick("camera");
                  if (uri) setIsPreviewVisible(false);
                },
              },
              {
                label: "Choose photo",
                icon: "image",
                onPress: async () => {
                  const uri = await handleImagePick("gallery");
                  if (uri) setIsPreviewVisible(false);
                },
              },
              {
                label: "Delete photo",
                icon: "trash-2",
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
          const uri = await handleImagePick("camera");
          setShowPhotoSheet(false);
        }}
        onChoosePhoto={async () => {
          const uri = await handleImagePick("gallery");
          setShowPhotoSheet(false);
        }}
        onDeletePhoto={
          profileImage
            ? async () => {
                await handleDeletePhoto();
                setShowPhotoSheet(false);
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingBottom: spacing[24],
  },
  avatarContainer: {
    width: sizes.avatar.xxl,
    height: sizes.avatar.xxl,
    borderRadius: spacing[40],
    ...elevation.md,
    shadowOpacity: 0.16,
    shadowRadius: spacing[8],
    ...Platform.select({
      web: { boxShadow: "0 6px 16px rgba(0,0,0,0.16)" },
    }),
  },
  avatarInner: {
    width: sizes.avatar.xxl,
    height: sizes.avatar.xxl,
    borderRadius: spacing[40],
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    ...typography.displayXL,
    fontFamily: typography.title.fontFamily,
    color: "#FFFFFF",
    lineHeight: 42,
  },
  avatarImageAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  profileInfoContainer: {
    flex: 1,
    gap: semanticSpacing.inlineGap,
  },
  nameContainer: {
    gap: spacing[0],
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
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing[4],
  },
  ratingText: {
    ...typography.label,
    fontFamily: typography.title.fontFamily,
  },
  contactDetails: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  phone: { ...typography.bodySmall },
  email: { ...typography.label, fontFamily: typography.caption.fontFamily },
  driverBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.screenPadding,
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingVertical: semanticSpacing.cardPadding,
    minHeight: sizes.input.lg,
    borderRadius: radius.card,
    gap: semanticSpacing.listItemPadding,
    ...Platform.select({
      ios: { borderCurve: "continuous" },
    }),
  },
  driverBannerIcon: {
    width: sizes.avatar.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { ...typography.title },
  bannerDesc: {
    ...typography.label,
    fontFamily: typography.caption.fontFamily,
    marginTop: spacing[2],
  },
  sectionGroup: {
    gap: spacing[10],
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: semanticSpacing.screenPadding,
  },
  sectionTitle: {
    ...typography.h3,
    fontFamily: typography.badge.fontFamily,
    letterSpacing: -0.2,
    marginLeft: spacing[2],
  },
  menuSection: {
    borderRadius: radius.card,
    overflow: "hidden",
    ...Platform.select({
      ios: { borderCurve: "continuous" },
    }),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: semanticSpacing.listItemPadding,
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingVertical: semanticSpacing.cardPadding,
    minHeight: sizes.input.lg,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[64] + spacing[2],
  },
  menuIcon: {
    width: sizes.avatar.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1, gap: spacing[2] },
  menuLabel: { ...typography.body },
  menuDetail: {
    ...typography.tiny,
    fontFamily: typography.caption.fontFamily,
    lineHeight: 16,
  },
  version: {
    ...typography.caption,
    textAlign: "center",
    paddingVertical: semanticSpacing.inlineGap,
  },
});
