import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated as RNAnimated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { NotificationsIcon } from "@/components/NotificationsIcon";
import { buttonCornerRadius, BUTTON_HEIGHT } from "@/constants/buttons";
import { elevation } from "@/constants/elevation";
import { icons } from "@/constants/icons";
import { spring } from "@/constants/motion";
import { radius } from "@/constants/radius";
import { sizes } from "@/constants/sizes";
import { spacing, semanticSpacing } from "@/constants/spacing";
import {
  DRIVER_CTA_FADE_MS,
  DRIVER_CTA_MESSAGES,
  DRIVER_CTA_PILL_WIDTH,
  DRIVER_CTA_ROTATION_MS,
} from "@/constants/homeDriverCta";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatHomeHeaderLocation } from "@/utils/locationUtils";
import { getDriverApplicationAction } from "@/utils/driverVerification";
import type { DriverVerificationStatus } from "@/types";
import { typography } from "@/constants/typography";
import { fonts } from "@/constants/fonts";
import { zIndex } from "@/constants/zIndex";
import { navigateToDriverHomeAfterCompletion } from "@/navigation/navigationPolicy";
import { useProfilePhotoActions } from "@/hooks/useProfilePhotoActions";
import { useUnreadNotificationCountQuery } from "@/query/hooks/useNotificationsQuery";

const AVATAR_SIZE = sizes.iconButton.md;
const CTA_AVATAR_SIZE = sizes.iconButton.sm;
const CTA_AVATAR_INSET = 5;
const PILL_HEIGHT = BUTTON_HEIGHT.sm;
const CTA_LEFT_WIDTH = CTA_AVATAR_INSET + CTA_AVATAR_SIZE + spacing[6];
const CTA_PILL_PADDING_RIGHT = spacing[6];
const CTA_LABEL_SLOT_WIDTH =
  DRIVER_CTA_PILL_WIDTH - CTA_LEFT_WIDTH - CTA_PILL_PADDING_RIGHT;
const CTA_SLIDE_THRESHOLD_RATIO = 0.7;
const FADE_HALF_MS = DRIVER_CTA_FADE_MS / 2;
const DRIVER_DASHBOARD_IMAGE_SOURCES: ImageSourcePropType[] = [
  require("../assets/images/verified badge.png"),
  require("../assets/ads/dashboard/airtel.jpg"),
  require("../assets/ads/dashboard/jibu.jpg"),
  require("../assets/ads/bralirwa.png"),
];

function prefetchImageSource(source: ImageSourcePropType) {
  if (
    typeof Image.resolveAssetSource !== "function" ||
    typeof Image.prefetch !== "function"
  )
    return;
  const uri = Image.resolveAssetSource(source)?.uri;
  if (uri) void Image.prefetch(uri).catch(() => {});
}

export type HomeTopHeaderProps = {
  paddingTop: number;
  locationText: string;
  locLoading: boolean;
  profileInitial: string;
  driverVerificationStatus: DriverVerificationStatus;
  canSwitchToDriverMode: boolean;
  driverApplicationDraftUpdatedAt?: string | null;
  driverApprovalAcknowledgedAt?: string | null;
};

/** Shared caption size for CTA label and compact location line. */
const HEADER_CAPTION_TEXT = {
  ...typography.caption,
  fontFamily: typography.title.fontFamily,
  lineHeight: 16,
};

export function HomeTopHeader({
  paddingTop,
  locationText,
  locLoading,
  profileInitial,
  driverVerificationStatus,
  canSwitchToDriverMode,
  driverApplicationDraftUpdatedAt,
  driverApprovalAcknowledgedAt,
}: HomeTopHeaderProps) {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const { driverProfile, switchMode } = useAuth();
  const { profileImage, refreshProfileImage } = useProfilePhotoActions(
    driverProfile?.profileImage ?? null,
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const { data: unreadNotificationCount = 0 } =
    useUnreadNotificationCountQuery();
  const messageOpacity = useSharedValue(1);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIndexRef = useRef(0);
  const switchModeTrackWidthRef = useRef(DRIVER_CTA_PILL_WIDTH);
  const switchModeAvatarSlide = useRef(new RNAnimated.Value(0)).current;

  const driverApplicationAction = getDriverApplicationAction(
    driverProfile,
    driverApplicationDraftUpdatedAt,
    driverApprovalAcknowledgedAt,
  );
  const shouldShowDriverModeSlider =
    canSwitchToDriverMode && driverApplicationAction.route === "/(driver)";
  const ctaMessage =
    driverVerificationStatus === "pending_review"
      ? "In Review"
      : driverVerificationStatus === "rejected"
        ? "Update application"
        : driverVerificationStatus === "approved"
          ? driverApplicationAction.label
          : driverVerificationStatus === "draft"
            ? driverApplicationAction.label
            : DRIVER_CTA_MESSAGES[messageIndex];
  const headerLocationLine = formatHomeHeaderLocation(locationText, locLoading);

  const advanceMessageIndex = useCallback(() => {
    messageIndexRef.current =
      (messageIndexRef.current + 1) % DRIVER_CTA_MESSAGES.length;
    setMessageIndex(messageIndexRef.current);
  }, []);

  const rotateCtaMessage = useCallback(() => {
    if (reduceMotion) {
      advanceMessageIndex();
      return;
    }

    messageOpacity.value = withTiming(
      0,
      { duration: FADE_HALF_MS },
      (finished) => {
        if (!finished) return;
        runOnJS(advanceMessageIndex)();
        messageOpacity.value = withTiming(1, { duration: FADE_HALF_MS });
      },
    );
  }, [advanceMessageIndex, messageOpacity, reduceMotion]);

  const ctaLabelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canSwitchToDriverMode) return;
    DRIVER_DASHBOARD_IMAGE_SOURCES.forEach(prefetchImageSource);
  }, [canSwitchToDriverMode]);

  useFocusEffect(
    useCallback(() => {
      switchModeAvatarSlide.setValue(0);
      setIsSwitchingMode(false);
    }, [switchModeAvatarSlide]),
  );

  useEffect(() => {
    void refreshProfileImage().catch(() => {});
  }, [driverProfile?.profileImage, refreshProfileImage]);

  useFocusEffect(
    useCallback(() => {
      if (driverVerificationStatus !== "not_started") {
        return undefined;
      }

      rotationTimerRef.current = setInterval(
        rotateCtaMessage,
        DRIVER_CTA_ROTATION_MS,
      );

      return () => {
        if (rotationTimerRef.current) {
          clearInterval(rotationTimerRef.current);
          rotationTimerRef.current = null;
        }
      };
    }, [driverVerificationStatus, rotateCtaMessage]),
  );

  const renderAvatar = (size: number, embeddedInCta = false) => {
    const radius = size / 2;
    const frameStyle = embeddedInCta
      ? [
          styles.ctaAvatarFrame,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]
      : [
          styles.avatarShadow,
          {
            width: size,
            height: size,
            borderRadius: radius,
            shadowOpacity: isDark ? 0.28 : 0.16,
          },
        ];

    return (
      <View style={frameStyle}>
        <View
          style={[
            styles.avatarCircle,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <LinearGradient
            colors={["#9DBBE0", "#7984C3"]}
            style={[
              styles.avatarFallback,
              { width: size, height: size, borderRadius: radius },
            ]}
          >
            <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
              {profileInitial}
            </Text>
          </LinearGradient>
          {profileImage ? (
            <Image
              key={profileImage}
              source={{ uri: profileImage }}
              style={[StyleSheet.absoluteFill, { width: size, height: size }]}
            />
          ) : null}
        </View>
      </View>
    );
  };

  const handleDriverCtaPress = () => {
    if (driverVerificationStatus === "pending_review")
      router.push("/driver-submission-confirmation");
    else if (driverVerificationStatus === "approved")
      router.push(driverApplicationAction.route);
    else router.push("/driver-onboarding");
  };

  const getSwitchModeSlideEnd = useCallback(
    () =>
      Math.max(
        0,
        switchModeTrackWidthRef.current -
          CTA_AVATAR_SIZE -
          CTA_AVATAR_INSET * 2 -
          CTA_PILL_PADDING_RIGHT,
      ),
    [],
  );

  const isSwitchModeAvatarStart = useCallback(
    (locationX: number | undefined) =>
      typeof locationX === "number" &&
      locationX >= 0 &&
      locationX <= CTA_AVATAR_INSET + CTA_AVATAR_SIZE,
    [],
  );

  const setSwitchModeSlideValue = useCallback(
    (nextX: number) => {
      switchModeAvatarSlide.setValue(nextX);
    },
    [switchModeAvatarSlide],
  );

  const animateSwitchAvatarToStart = useCallback(() => {
    RNAnimated.spring(switchModeAvatarSlide, {
      toValue: 0,
      ...spring.card,
    }).start();
  }, [switchModeAvatarSlide]);

  const handleSwitchToDriver = useCallback(async () => {
    if (isSwitchingMode || !canSwitchToDriverMode) return;
    setIsSwitchingMode(true);
    RNAnimated.timing(switchModeAvatarSlide, {
      toValue: getSwitchModeSlideEnd(),
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      void (async () => {
        try {
          await switchMode("driver");
          navigateToDriverHomeAfterCompletion(router);
        } catch {
          switchModeAvatarSlide.setValue(0);
          setIsSwitchingMode(false);
        }
      })();
    });
  }, [
    canSwitchToDriverMode,
    getSwitchModeSlideEnd,
    isSwitchingMode,
    switchMode,
    switchModeAvatarSlide,
  ]);

  const handleSwitchModeCtaLayout = useCallback((event: LayoutChangeEvent) => {
    switchModeTrackWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const switchModePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          canSwitchToDriverMode &&
          !isSwitchingMode &&
          isSwitchModeAvatarStart(event.nativeEvent.locationX),
        onMoveShouldSetPanResponder: (_, gestureState) =>
          canSwitchToDriverMode &&
          !isSwitchingMode &&
          Math.abs(gestureState.dx) > 2 &&
          Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          if (isSwitchingMode) return;
          switchModeAvatarSlide.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isSwitchingMode) return;
          const slideEnd = getSwitchModeSlideEnd();
          const nextX = Math.min(slideEnd, Math.max(0, gestureState.dx));
          setSwitchModeSlideValue(nextX);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isSwitchingMode) return;
          const slideEnd = getSwitchModeSlideEnd();
          const threshold = slideEnd * CTA_SLIDE_THRESHOLD_RATIO;
          if (gestureState.dx >= threshold) {
            void handleSwitchToDriver();
            return;
          }
          animateSwitchAvatarToStart();
        },
        onPanResponderTerminate: () => {
          if (!isSwitchingMode) animateSwitchAvatarToStart();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      animateSwitchAvatarToStart,
      canSwitchToDriverMode,
      getSwitchModeSlideEnd,
      handleSwitchToDriver,
      isSwitchingMode,
      isSwitchModeAvatarStart,
      setSwitchModeSlideValue,
      switchModeAvatarSlide,
    ],
  );

  const switchModeLabelMaskScale =
    typeof switchModeAvatarSlide.interpolate === "function"
      ? switchModeAvatarSlide.interpolate({
          inputRange: [0, CTA_LABEL_SLOT_WIDTH],
          outputRange: [0, 1],
          extrapolate: "clamp",
        })
      : 0;
  const switchModeLabelMaskTranslateX =
    typeof switchModeAvatarSlide.interpolate === "function"
      ? switchModeAvatarSlide.interpolate({
          inputRange: [0, CTA_LABEL_SLOT_WIDTH],
          outputRange: [-CTA_LABEL_SLOT_WIDTH / 2, 0],
          extrapolate: "clamp",
        })
      : -CTA_LABEL_SLOT_WIDTH / 2;

  return (
    <View style={[styles.topBar, { paddingTop }]}>
      {shouldShowDriverModeSlider ? (
        <View
          style={[
            styles.driverCtaPill,
            {
              width: DRIVER_CTA_PILL_WIDTH,
              backgroundColor: colors.primary,
              shadowOpacity: isDark ? 0.4 : 0.22,
            },
          ]}
          onLayout={handleSwitchModeCtaLayout}
          accessibilityRole="button"
          accessibilityLabel="Slide to switch to driver mode"
          accessibilityHint={
            driverApplicationAction.route === "/(driver)"
              ? "Double tap to switch to driver mode"
              : "Double tap to review your approved application"
          }
          accessibilityActions={[
            { name: "activate", label: "Switch to driver mode" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate")
              void handleSwitchToDriver();
          }}
          onAccessibilityTap={() => void handleSwitchToDriver()}
          {...switchModePanResponder.panHandlers}
        >
          <View
            style={styles.ctaAvatarInset}
            testID="driver-mode-avatar-drag-handle"
          >
            <RNAnimated.View
              style={[
                styles.ctaAvatarSlideFrame,
                { transform: [{ translateX: switchModeAvatarSlide }] },
              ]}
            >
              {renderAvatar(CTA_AVATAR_SIZE, true)}
            </RNAnimated.View>
          </View>
          <RNAnimated.View
            style={[styles.ctaLabelSlot, { width: CTA_LABEL_SLOT_WIDTH }]}
            pointerEvents="none"
          >
            <Text
              style={[styles.ctaLabel, { color: colors.primaryForeground }]}
              numberOfLines={1}
            >
              {ctaMessage}
            </Text>
            <RNAnimated.View
              style={[
                styles.ctaLabelMask,
                {
                  backgroundColor: colors.primary,
                  transform: [
                    { translateX: switchModeLabelMaskTranslateX },
                    { scaleX: switchModeLabelMaskScale },
                  ],
                },
              ]}
            />
          </RNAnimated.View>
        </View>
      ) : (
        <Pressable
          onPress={handleDriverCtaPress}
          style={[
            styles.driverCtaPill,
            {
              width: DRIVER_CTA_PILL_WIDTH,
              backgroundColor: colors.primary,
              shadowOpacity: isDark ? 0.4 : 0.22,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaMessage}
          accessibilityHint={
            driverApplicationAction.route === "/(driver)"
              ? "Opens driver mode"
              : "Opens the submitted driver application"
          }
        >
          <View style={styles.ctaAvatarInset}>
            {renderAvatar(CTA_AVATAR_SIZE, true)}
          </View>
          <View style={[styles.ctaLabelSlot, { width: CTA_LABEL_SLOT_WIDTH }]}>
            <Reanimated.Text
              style={[
                styles.ctaLabel,
                ctaLabelAnimatedStyle,
                { color: colors.primaryForeground },
              ]}
              numberOfLines={1}
            >
              {ctaMessage}
            </Reanimated.Text>
          </View>
        </Pressable>
      )}
      <View
        style={[
          styles.locationCard,
          styles.locationCardCompact,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={styles.locationRowCompact}>
          <Feather
            name="map-pin"
            size={icons.semantic.button}
            color={colors.primary}
          />
          <Text
            style={[
              styles.locationCompactText,
              HEADER_CAPTION_TEXT,
              { color: colors.foreground },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {headerLocationLine}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.notifBtn,
          {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark
              ? "rgba(30, 30, 30, 0.85)"
              : "rgba(255, 255, 255, 0.9)",
            borderWidth: 1,
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(0, 0, 0, 0.1)",
            shadowOpacity: 0,
            elevation: 0,
            marginRight: 8,
          },
        ]}
        onPress={() => router.push("/notifications")}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <NotificationsIcon size={24} color={colors.primary} />
        {unreadNotificationCount > 0 && (
          <View
            style={[
              styles.notifBadge,
              {
                backgroundColor: isDark ? "#FFFFFF" : "#000000",
                borderColor: isDark ? "#1E1E1E" : "#FFFFFF",
              },
            ]}
          >
            <Text
              style={{
                color: isDark ? "#000000" : "#FFFFFF",
                fontFamily: fonts.bold,
                fontSize: 8,
                fontWeight: "bold",
                textAlign: "center",
                textAlignVertical: "center",
                includeFontPadding: false,
              }}
            >
              {unreadNotificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: spacing[0],
    left: spacing[0],
    right: spacing[0],
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: semanticSpacing.cardPadding,
    gap: spacing[10],
    zIndex: zIndex.tooltip,
  },
  driverCtaPill: {
    height: PILL_HEIGHT,
    borderRadius: buttonCornerRadius(PILL_HEIGHT),
    flexDirection: "row",
    alignItems: "center",
    paddingRight: CTA_PILL_PADDING_RIGHT,
    flexShrink: 0,
    ...elevation.lg,
    ...Platform.select({
      ios: { borderCurve: "continuous" },
      default: {},
    }),
  },
  ctaAvatarInset: {
    marginLeft: CTA_AVATAR_INSET,
    marginVertical: CTA_AVATAR_INSET,
    flexShrink: 0,
    zIndex: 3,
    elevation: 8,
  },
  ctaAvatarSlideFrame: {
    zIndex: 3,
    elevation: 8,
  },
  /** Thin white ring + shadow so the photo reads on the blue CTA. */
  ctaAvatarFrame: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    zIndex: 3,
    elevation: 8,
    ...Platform.select({
      ios: { borderCurve: "continuous" },
      default: {},
    }),
  },
  ctaLabelSlot: {
    justifyContent: "center",
    minWidth: 0,
    paddingLeft: 3,
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  ctaLabelMask: {
    position: "absolute",
    top: spacing[0],
    bottom: spacing[0],
    left: spacing[0],
    width: CTA_LABEL_SLOT_WIDTH,
    zIndex: 2,
  },
  ctaLabel: {
    ...HEADER_CAPTION_TEXT,
    zIndex: 1,
  },
  profileOnlyBtn: {
    width: AVATAR_SIZE,
    height: PILL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
    ...Platform.select({
      ios: { borderCurve: "continuous" },
      default: {},
    }),
  },
  avatarShadow: {
    flexShrink: 0,
    ...elevation.md,
    shadowRadius: 6,
    ...Platform.select({
      ios: { borderCurve: "continuous" },
      default: {},
    }),
  },
  avatarCircle: {
    overflow: "hidden",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: typography.title.fontFamily,
    color: "#FFFFFF",
  },
  locationCard: {
    flex: 1,
    minWidth: 0,
    minHeight: PILL_HEIGHT,
    borderRadius: buttonCornerRadius(PILL_HEIGHT),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: "center",
  },
  locationCardCompact: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  locationRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: semanticSpacing.compactGap,
    minWidth: 0,
  },
  locationCompactText: {
    flex: 1,
    minWidth: 0,
    textAlign: "left",
  },
  notifBtn: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
