import { typography } from "@/constants/typography";
import { AppText } from "@/components/AppText";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
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
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useColors } from "@/hooks/useColors";
import { useVehicles } from "@/domains/vehicle";
import { APP_NAME } from "@/constants/branding";
import { getShareRouteForMode } from "@/navigation/shareNavigation";
import { getRatingInformationRoute } from "@/navigation/ratingNavigation";
import { leaveRidesFeedback, rateRides } from "@/utils/communityActions";
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from "@/constants/tabBar";
import { PrivacySecurityIcon } from "@/components/PrivacySecurityIcon";
import { HelpSupportIcon } from "@/components/HelpSupportIcon";
import { AlertsIcon } from "@/components/AlertsIcon";
import { AboutRidesIcon } from "@/components/AboutRidesIcon";
import { SwitchModeIcon } from "@/components/SwitchModeIcon";
import { EditProfileIcon } from "@/components/EditProfileIcon";
import { ImageGalleryPreview } from "@/components/ImageGalleryPreview";
import { useProfilePhotoActions } from "@/hooks/useProfilePhotoActions";
import { useProfile } from "@/domains/profile";
import { ProfilePhotoEditSheet } from "@/components/ProfilePhotoEditSheet";
import { elevation } from "@/constants/elevation";
import { icons } from "@/constants/icons";
import { radius } from "@/constants/radius";
import { prefetchRatingInformationImages } from "@/constants/ratingInformationImages";
import { sizes } from "@/constants/sizes";
import { spacing, semanticSpacing } from "@/constants/spacing";
import { navigateToCustomerHomeAfterCompletion } from "@/navigation/navigationPolicy";
import { useDriverRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";
import { useDriverRatingsQuery } from "@/query/hooks/useDriverRatingsQuery";
import { useDriverStatsQuery } from "@/query/hooks/useDriverStatsQuery";
import { usePressGuard } from "@/hooks/usePressGuard";

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const { user, driverProfile, switchMode, profile } = useProfile();
  const { data: rideHistory = [] } = useDriverRideHistoryQuery(user?.id);
  const { data: ratingSummary = { averageRating: null, ratingCount: 0 } } =
    useDriverRatingsQuery();
  const { data: driverStats } = useDriverStatsQuery();
  const { vehicles } = useVehicles();
  const vehicleCounts = React.useMemo(
    () => ({
      approved: vehicles.filter((vehicle) => vehicle.status === "approved")
        .length,
      pendingReview: vehicles.filter(
        (vehicle) => vehicle.status === "pending_review",
      ).length,
      rejected: vehicles.filter((vehicle) => vehicle.status === "rejected")
        .length,
    }),
    [vehicles],
  );
  const { profileImage, handleImagePick, handleDeletePhoto } =
    useProfilePhotoActions();
  const completedRides = rideHistory.filter(
    (ride) => ride.driverId === user?.id && ride.status === "completed",
  );
  const totalDistance = completedRides.reduce(
    (sum, ride) => sum + (ride.distance || 0),
    0,
  );
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = React.useState(false);
  const cardFill = isDark ? "#1C1C1E" : "#FFFFFF";
  const pageBackground = isDark ? "#000000" : "#F2F2F7";
  // All-time trips are backend-authoritative (GET /v1/driver/stats); fall back
  // to the local profile counter only until the stats endpoint responds.
  const allTimeTrips = driverStats?.totalRides ?? driverProfile?.completedRides ?? 0;

  const handleEditProfile = usePressGuard(() => router.push("/edit-profile"));
  const handleRatingInfo = usePressGuard(() => {
    prefetchRatingInformationImages();
    router.push(getRatingInformationRoute(user?.mode) as never);
  });
  const handleSwitchToCustomer = usePressGuard(() => {
    Alert.alert("Switch Mode", "Switch to customer mode?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Switch",
        onPress: async () => {
          await switchMode("customer");
          navigateToCustomerHomeAfterCompletion(router);
        },
      },
    ]);
  });

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

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <View
        style={{
          paddingTop: insets.top + semanticSpacing.comfortableGap,
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
                    {driverProfile?.isVerified === true ? (
                      <VerifiedBadge size={icons.size.xl} />
                    ) : null}
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
                  {driverProfile?.isVerified === true ? (
                    <VerifiedBadge size={icons.size.xl} />
                  ) : null}
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.statColumn}
                onPress={handleRatingInfo}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Open rating information"
                accessibilityHint="Explains how your rating works"
                hitSlop={8}
              >
                <View style={styles.ratingGroup}>
                  <FontAwesome
                    name="star"
                    size={spacing[10]}
                    color={colors.primary}
                    style={{ marginRight: 3 }}
                  />
                  <AppText
                    style={[styles.statHeaderVal, { color: colors.foreground }]}
                  >
                    {ratingSummary.averageRating?.toFixed(1) ?? "0.0"}
                  </AppText>
                </View>
                <AppText
                  style={[
                    styles.statHeaderLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Rating
                </AppText>
              </TouchableOpacity>

              <View style={styles.statColumn}>
                <AppText
                  style={[styles.statHeaderVal, { color: colors.foreground }]}
                >
                  {allTimeTrips}
                </AppText>
                <AppText
                  style={[
                    styles.statHeaderLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Trips
                </AppText>
              </View>

              <View style={styles.statColumn}>
                <AppText
                  style={[styles.statHeaderVal, { color: colors.foreground }]}
                >
                  {totalDistance.toFixed(1)} km
                </AppText>
                <AppText
                  style={[
                    styles.statHeaderLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Distance
                </AppText>
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
            accessibilityLabel={
              profileImage ? "Preview profile image" : "Upload profile image"
            }
          >
            <View style={styles.avatarContainer}>
              <View style={styles.avatarInner}>
                <LinearGradient
                  colors={["#69A8F7", "#6674D8"]}
                  style={styles.avatarGradient}
                />
                <AppText style={styles.avatarInitial}>{profileInitial}</AppText>
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
          paddingTop: semanticSpacing.inlineGap,
          paddingBottom:
            insets.bottom + TAB_BAR_SCREEN_BOTTOM_PADDING + spacing[16],
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: radius.sheetCompact,
        }}
      >
        <View style={styles.section}>
          <SectionTitle title="My vehicles" />
          <TouchableOpacity
            style={[
              styles.vehicleSummaryCard,
              styles.cardShadow,
              { backgroundColor: cardFill },
            ]}
            onPress={() => router.push("/driver-vehicles")}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Open my vehicles"
          >
            <Feather name="truck" size={icons.size.lg} color={colors.primary} />
            <View style={styles.vehicleSummaryCopy}>
              <AppText
                style={[
                  styles.vehicleSummaryTitle,
                  { color: colors.foreground },
                ]}
              >
                {vehicles.length}{" "}
                {vehicles.length === 1 ? "vehicle" : "vehicles"} linked
              </AppText>
              <AppText
                style={[
                  styles.vehicleSummaryDetail,
                  { color: colors.mutedForeground },
                ]}
              >
                Approved {vehicleCounts.approved} • Pending{" "}
                {vehicleCounts.pendingReview} • Rejected{" "}
                {vehicleCounts.rejected}
              </AppText>
            </View>
            <Feather
              name="chevron-right"
              size={icons.semantic.row}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Account" />
          <View
            style={[
              styles.groupedSection,
              styles.cardShadow,
              { backgroundColor: cardFill },
            ]}
          >
            <MenuItem
              colors={colors}
              icon={<EditProfileIcon />}
              label="Edit Profile"
              onPress={() => router.push("/edit-profile")}
            />
            <MenuItem
              colors={colors}
              icon={<AlertsIcon />}
              label="Notifications"
              onPress={() => router.push("/notifications")}
            />
            <MenuItem
              colors={colors}
              icon={<PrivacySecurityIcon />}
              label="Privacy and Security"
              onPress={() => router.push("/privacy-security")}
            />
            <MenuItem
              colors={colors}
              icon={<HelpSupportIcon />}
              label="Help and Support"
              onPress={() => router.push("/help-support")}
            />
            <MenuItem
              colors={colors}
              icon={<AboutRidesIcon />}
              label={`About ${APP_NAME}`}
              onPress={() => router.push("/about")}
            />
            <MenuItem
              colors={colors}
              iconFamily="feather"
              icon="settings"
              label="Settings"
              onPress={() => router.push("/settings")}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Mode" />
          <TouchableOpacity
            style={[
              styles.modeCard,
              styles.cardShadow,
              { backgroundColor: cardFill },
            ]}
            onPress={handleSwitchToCustomer}
            activeOpacity={0.72}
          >
            <SwitchModeIcon size={icons.size.lg} />
            <View style={styles.modeCopy}>
              <AppText
                variant="body"
                style={[styles.modeTitle, { color: colors.foreground }]}
              >
                Switch to Customer Mode
              </AppText>
              <AppText
                variant="label"
                style={[
                  styles.modeDescription,
                  { color: colors.mutedForeground },
                ]}
              >
                Book rides using your customer account
              </AppText>
            </View>
            <Feather
              name="chevron-right"
              size={icons.semantic.row}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Community" />
          <View
            style={[
              styles.groupedSection,
              styles.cardShadow,
              { backgroundColor: cardFill },
            ]}
          >
            <MenuItem
              colors={colors}
              iconFamily="feather"
              icon="star"
              label={`Rate ${APP_NAME}`}
              detail="Enjoying the app? Take a moment to rate it and share your feedback."
              onPress={() => {
                void rateRides();
              }}
            />
            <MenuItem
              colors={colors}
              iconFamily="mci"
              icon="message-text"
              label="Leave Feedback"
              detail="We'd love to hear from you."
              onPress={() => {
                void leaveRidesFeedback();
              }}
            />
            <MenuItem
              colors={colors}
              iconFamily="symbol"
              icon="share-2"
              label="Share the App"
              detail={`Invite friends and family to experience ${APP_NAME}.`}
              onPress={() => router.push(getShareRouteForMode(user?.mode))}
              last
            />
          </View>
        </View>

        <AppText style={[styles.version, { color: colors.mutedForeground }]}>
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

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>
      {title}
    </AppText>
  );
}

// QuickStat deleted

function MenuItem({
  colors,
  detail,
  iconFamily = "mci",
  icon,
  label,
  last = false,
  onPress,
}: {
  colors: ReturnType<typeof useColors>;
  detail?: string;
  iconFamily?: "feather" | "mci" | "symbol";
  icon:
    | keyof typeof Feather.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap
    | React.ReactNode;
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  const guardedPress = usePressGuard(onPress);
  return (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={guardedPress}
        activeOpacity={0.62}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.menuIcon}>
          {React.isValidElement(icon) ? (
            icon
          ) : iconFamily === "symbol" ? (
            <SymbolView
              name="square.and.arrow.up"
              tintColor={colors.primary}
              size={icons.size.lg}
            />
          ) : iconFamily === "feather" ? (
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={icons.size.lg}
              color={colors.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={icons.size.lg}
              color={colors.primary}
            />
          )}
        </View>
        <View style={styles.menuCopy}>
          <AppText style={[styles.menuLabel, { color: colors.foreground }]}>
            {label}
          </AppText>
          {detail ? (
            <AppText
              style={[styles.menuDetail, { color: colors.mutedForeground }]}
            >
              {detail}
            </AppText>
          ) : null}
        </View>
        <Feather
          name="chevron-right"
          size={icons.semantic.row}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>
      {!last ? (
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingBottom: semanticSpacing.rowGap,
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing[32],
    marginTop: spacing[2],
  },
  statColumn: {
    alignItems: "center",
    gap: spacing[0],
  },
  ratingGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  statHeaderVal: {
    ...typography.label,
  },
  statHeaderLabel: {
    ...typography.tiny,
  },
  avatarContainer: {
    width: sizes.avatar.xxl,
    height: sizes.avatar.xxl,
    borderRadius: spacing[40],
    ...elevation.md,
    shadowOffset: { width: 0, height: 3 },
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    maxWidth: "100%",
    minWidth: spacing[0],
    flexShrink: 1,
  },
  phone: { ...typography.label },
  section: { gap: spacing[10] },
  sectionTitle: {
    ...typography.h3,
    letterSpacing: -0.2,
    marginLeft: spacing[2],
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    ...Platform.select({ web: { boxShadow: "0 6px 18px rgba(0,0,0,0.08)" } }),
  },
  vehicleSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: semanticSpacing.rowGap,
    borderRadius: radius["3xl"],
    padding: semanticSpacing.cardPadding,
  },
  vehicleSummaryCopy: { flex: 1, gap: 3 },
  vehicleSummaryTitle: { ...typography.body },
  vehicleSummaryDetail: { ...typography.tiny },
  groupedSection: { borderRadius: radius["3xl"], overflow: "hidden" },

  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[14],
    minHeight: sizes.avatar.lg,
    paddingHorizontal: semanticSpacing.screenPadding,
    paddingVertical: semanticSpacing.cardPadding,
  },
  menuIcon: {
    width: sizes.avatar.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1, gap: spacing[2] },
  menuLabel: { ...typography.body },
  menuDetail: { ...typography.tiny, lineHeight: 16 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: radius["3xl"],
    padding: semanticSpacing.cardPadding,
  },
  modeCopy: { flex: 1, gap: 3 },
  modeTitle: { ...typography.body },
  modeDescription: {
    ...typography.label,
    fontFamily: typography.caption.fontFamily,
    marginTop: spacing[2],
  },
  version: {
    textAlign: "center",
    ...typography.caption,
    paddingVertical: semanticSpacing.inlineGap,
  },
});
