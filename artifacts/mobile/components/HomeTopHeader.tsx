import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import {
  DRIVER_CTA_FADE_MS,
  DRIVER_CTA_MESSAGES,
  DRIVER_CTA_PILL_WIDTH,
  DRIVER_CTA_ROTATION_MS,
} from '@/constants/homeDriverCta';
import { useColors } from '@/hooks/useColors';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';
import { formatHomeHeaderLocation } from '@/utils/locationUtils';
import type { DriverVerificationStatus } from '@/types';

const AVATAR_SIZE = 44;
const CTA_AVATAR_SIZE = 34;
const CTA_AVATAR_INSET = 5;
const PILL_HEIGHT = BUTTON_HEIGHT.sm;
const CTA_LEFT_WIDTH = CTA_AVATAR_INSET + CTA_AVATAR_SIZE + 6;
const CTA_PILL_PADDING_RIGHT = 6;
const CTA_LABEL_SLOT_WIDTH = DRIVER_CTA_PILL_WIDTH - CTA_LEFT_WIDTH - CTA_PILL_PADDING_RIGHT;
const FADE_HALF_MS = DRIVER_CTA_FADE_MS / 2;

export type HomeTopHeaderProps = {
  paddingTop: number;
  locationText: string;
  locLoading: boolean;
  profileInitial: string;
  driverVerificationStatus: DriverVerificationStatus;
};

/** Shared caption size for CTA label and compact location line. */
const HEADER_CAPTION_TEXT = {
  fontSize: 12.5,
  fontFamily: 'Inter_600SemiBold' as const,
  lineHeight: 16,
};

export function HomeTopHeader({
  paddingTop,
  locationText,
  locLoading,
  profileInitial,
  driverVerificationStatus,
}: HomeTopHeaderProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const messageOpacity = useSharedValue(1);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIndexRef = useRef(0);

  const ctaMessage = driverVerificationStatus === 'pending_review'
    ? 'In Review'
    : driverVerificationStatus === 'rejected'
      ? 'Update application'
      : driverVerificationStatus === 'approved'
        ? 'Driver Mode'
        : driverVerificationStatus === 'draft'
          ? 'Continue application'
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

    messageOpacity.value = withTiming(0, { duration: FADE_HALF_MS }, finished => {
      if (!finished) return;
      runOnJS(advanceMessageIndex)();
      messageOpacity.value = withTiming(1, { duration: FADE_HALF_MS });
    });
  }, [advanceMessageIndex, messageOpacity, reduceMotion]);

  const ctaLabelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (driverVerificationStatus !== 'not_started') {
        return undefined;
      }

      rotationTimerRef.current = setInterval(rotateCtaMessage, DRIVER_CTA_ROTATION_MS);

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
        <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: radius }]}>
          {profileImage ? (
            <Image
              key={profileImage}
              source={{ uri: profileImage }}
              style={{ width: size, height: size }}
            />
          ) : (
            <LinearGradient
              colors={['#9DBBE0', '#7984C3']}
              style={[styles.avatarFallback, { width: size, height: size, borderRadius: radius }]}
            >
              <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{profileInitial}</Text>
            </LinearGradient>
          )}
        </View>
      </View>
    );
  };

  const handleDriverCtaPress = () => {
    if (driverVerificationStatus === 'pending_review') router.push('/driver-submission-confirmation');
    else if (driverVerificationStatus === 'approved') router.push('/(driver)');
    else router.push('/driver-onboarding');
  };

  return (
    <View style={[styles.topBar, { paddingTop }]}>
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
          accessibilityHint="Opens driver application or driver mode"
        >
          <View style={styles.ctaAvatarInset}>
            {renderAvatar(CTA_AVATAR_SIZE, true)}
          </View>
          <View style={[styles.ctaLabelSlot, { width: CTA_LABEL_SLOT_WIDTH }]}>
            <Animated.Text
              style={[
                styles.ctaLabel,
                ctaLabelAnimatedStyle,
                { color: colors.primaryForeground },
              ]}
              numberOfLines={1}
            >
              {ctaMessage}
            </Animated.Text>
          </View>
        </Pressable>
      <View style={[styles.locationCard, styles.locationCardCompact, { backgroundColor: colors.card }]}>
        <View style={styles.locationRowCompact}>
          <Feather name="map-pin" size={16} color={colors.primary} />
          <Text
            style={[styles.locationCompactText, HEADER_CAPTION_TEXT, { color: colors.foreground }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {headerLocationLine}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.notifBtn, { backgroundColor: colors.card }]}
        onPress={() => router.push('/notifications')}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Feather name="bell" size={20} color={colors.foreground} />
        <View
          style={[
            styles.notifBadge,
            { backgroundColor: colors.destructive, borderColor: colors.card },
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 100,
  },
  driverCtaPill: {
    height: PILL_HEIGHT,
    borderRadius: buttonCornerRadius(PILL_HEIGHT),
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: CTA_PILL_PADDING_RIGHT,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 6,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  ctaAvatarInset: {
    marginLeft: CTA_AVATAR_INSET,
    marginVertical: CTA_AVATAR_INSET,
    flexShrink: 0,
  },
  /** Thin white ring + shadow so the photo reads on the blue CTA. */
  ctaAvatarFrame: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 4,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  ctaLabelSlot: {
    justifyContent: 'center',
    minWidth: 0,
    paddingLeft: 3,
  },
  ctaLabel: {
    ...HEADER_CAPTION_TEXT,
  },
  profileOnlyBtn: {
    width: AVATAR_SIZE,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  avatarShadow: {
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  avatarCircle: {
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  locationCard: {
    flex: 1,
    minWidth: 0,
    minHeight: PILL_HEIGHT,
    borderRadius: buttonCornerRadius(PILL_HEIGHT),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'center',
  },
  locationCardCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  locationCompactText: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  notifBtn: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  notifBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
