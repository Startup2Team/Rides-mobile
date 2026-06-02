import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { APP_NAME } from '@/constants/branding';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';

const CARD_MAX_WIDTH = 320;
const DRIVER_ICON_SIZE = 64;

type RatingPhase = 'rate' | 'thanks' | 'review';

function StarRow({
  stars,
  colors,
  interactive,
  onStarPress,
  size = 'large',
}: {
  stars: number;
  colors: ReturnType<typeof useColors>;
  interactive: boolean;
  onStarPress?: (n: number) => void;
  size?: 'large' | 'medium';
}) {
  const starStyle = size === 'large' ? styles.starLarge : styles.starMedium;
  return (
    <View style={styles.starsRow} accessibilityRole="text" accessibilityLabel={`${stars} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= stars;
        const star = (
          <Text style={[starStyle, { color: filled ? colors.star : colors.starMuted }]}>★</Text>
        );
        if (!interactive || !onStarPress) {
          return <View key={n}>{star}</View>;
        }
        return (
          <Pressable
            key={n}
            onPress={() => onStarPress(n)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
            accessibilityState={{ selected: filled }}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RatingScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { currentRide, rideHistory, completeRide } = useRide();
  const params = useLocalSearchParams<{ rideId?: string; driverName?: string; fare?: string; vehicleType?: string }>();

  const [phase, setPhase] = useState<RatingPhase>('rate');
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const driverName = params.driverName ?? 'your driver';
  const finalizedRideRef = useRef(false);
  const reviewInputRef = useRef<TextInput>(null);
  const glassTint = colorScheme === 'dark' ? 'dark' : 'light';
  const scrimColor = colorScheme === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.4)';
  const cardBackground = colorScheme === 'dark' ? 'rgba(44,44,46,0.94)' : 'rgba(255,255,255,0.94)';
  const cardBorder = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';

  const ratedRide = useMemo(() => {
    if (currentRide && (!params.rideId || currentRide.id === params.rideId)) {
      return currentRide;
    }
    if (params.rideId) {
      return rideHistory.find(ride => ride.id === params.rideId) ?? currentRide;
    }
    return currentRide;
  }, [currentRide, params.rideId, rideHistory]);

  const driverPhotoUri = useMemo(() => {
    const driver = ratedRide?.driver;
    if (!driver) return undefined;
    return driver.profileImage ?? `https://i.pravatar.cc/160?u=${encodeURIComponent(driver.id)}`;
  }, [ratedRide?.driver]);

  const finalizeRide = () => {
    if (finalizedRideRef.current || !currentRide) return;
    finalizedRideRef.current = true;
    completeRide();
  };

  const finishAndExit = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (rideHistory.length >= 3) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) await StoreReview.requestReview();
    }

    finalizeRide();
    router.replace('/(tabs)');
  };

  const exitToHome = () => {
    finalizeRide();
    router.replace('/(tabs)');
  };

  const handleStarPress = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStars(n);
  };

  const handleRateSubmit = () => {
    if (stars === 0 || submitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('thanks');
  };

  const handleReviewSubmit = async () => {
    Keyboard.dismiss();
    await finishAndExit();
  };

  const handleReviewBack = () => {
    Keyboard.dismiss();
    setPhase('thanks');
  };

  useEffect(() => {
    if (phase !== 'review') return;
    const focusTimer = setTimeout(() => {
      reviewInputRef.current?.focus();
    }, 280);
    return () => clearTimeout(focusTimer);
  }, [phase]);

  const initials = driverName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const canRateSubmit = stars > 0 && !submitting;
  const backdropDismiss = phase === 'rate' ? exitToHome : undefined;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={backdropDismiss}
        disabled={!backdropDismiss}
        accessibilityRole="button"
        accessibilityLabel={backdropDismiss ? 'Not now' : undefined}
      >
        <BlurView intensity={48} tint={glassTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]} />
      </Pressable>

      {phase === 'review' ? (
        <KeyboardAwareScrollViewCompat
          style={styles.keyboardScroll}
          contentContainerStyle={[
            styles.keyboardScrollContent,
            {
              paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={insets.bottom + 12}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <View style={styles.keyboardDismissArea}>
            <View
              style={[styles.card, styles.reviewCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}
              accessibilityRole="alert"
              accessibilityLabel="Write a review"
            >
              <Text style={[styles.title, { color: colors.foreground }]}>Write a Review</Text>
              <Text style={[styles.subtitle, styles.thanksSubtitle, { color: colors.mutedForeground }]}>
                {`Share more about your trip with ${driverName}.`}
              </Text>

              <StarRow stars={stars} colors={colors} interactive={false} size="medium" />

              <TextInput
                ref={reviewInputRef}
                value={review}
                onChangeText={setReview}
                placeholder="Tell us about your driver"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={300}
                textAlignVertical="top"
                blurOnSubmit={false}
                returnKeyType="default"
                style={[
                  styles.reviewInput,
                  {
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={handleReviewBack}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  style={styles.actionBtn}
                  onPress={handleReviewSubmit}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Submit review"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.actionText, styles.actionTextBold, { color: colors.primary }]}>Submit</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollViewCompat>
      ) : (
      <View
        style={[styles.centerWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        {phase === 'rate' && (
          <View
            style={[styles.card, { backgroundColor: cardBackground, borderColor: cardBorder }]}
            accessibilityRole="alert"
            accessibilityLabel={`Rate ${driverName}`}
          >
            {driverPhotoUri ? (
              <Image
                source={{ uri: driverPhotoUri }}
                style={styles.driverIcon}
                accessibilityLabel={`${driverName} profile photo`}
              />
            ) : (
              <View style={[styles.driverIcon, styles.driverIconFallback, { backgroundColor: colors.primary }]}>
                <Text style={[styles.driverIconInitials, { color: colors.primaryForeground }]}>{initials}</Text>
              </View>
            )}

            <Text style={[styles.title, { color: colors.foreground }]}>Rate Your Driver</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {`How was your trip with ${driverName} on ${APP_NAME}?`}
            </Text>

            <StarRow stars={stars} colors={colors} interactive onStarPress={handleStarPress} />

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionBtn}
                onPress={exitToHome}
                accessibilityRole="button"
                accessibilityLabel="Not now"
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>Not Now</Text>
              </Pressable>
              <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
              <Pressable
                style={styles.actionBtn}
                onPress={handleRateSubmit}
                disabled={!canRateSubmit}
                accessibilityRole="button"
                accessibilityLabel="Submit rating"
                accessibilityState={{ disabled: !canRateSubmit }}
              >
                <Text
                  style={[
                    styles.actionText,
                    styles.actionTextBold,
                    { color: canRateSubmit ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  Submit
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === 'thanks' && (
          <View
            style={[styles.card, styles.thanksCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}
            accessibilityRole="alert"
            accessibilityLabel="Thanks for your feedback"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>Thanks for your feedback.</Text>
            <Text style={[styles.subtitle, styles.thanksSubtitle, { color: colors.mutedForeground }]}>
              You can also write a review.
            </Text>

            <StarRow stars={stars} colors={colors} interactive={false} size="medium" />

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => setPhase('review')}
                accessibilityRole="button"
                accessibilityLabel="Write a review"
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>Write a Review</Text>
              </Pressable>
              <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
              <Pressable
                style={styles.actionBtn}
                onPress={finishAndExit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="OK"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.actionText, styles.actionTextBold, { color: colors.primary }]}>OK</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardScroll: {
    flex: 1,
  },
  keyboardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  keyboardDismissArea: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: 'center',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 22,
    paddingBottom: 4,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 24,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  thanksCard: {
    paddingTop: 20,
  },
  reviewCard: {
    paddingTop: 20,
  },
  driverIcon: {
    width: DRIVER_ICON_SIZE,
    height: DRIVER_ICON_SIZE,
    borderRadius: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: 14,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  driverIconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverIconInitials: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  thanksSubtitle: {
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  starLarge: {
    fontSize: 40,
    lineHeight: 44,
  },
  starMedium: {
    fontSize: 32,
    lineHeight: 36,
  },
  reviewInput: {
    alignSelf: 'stretch',
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  actionsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  actionText: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
  },
  actionTextBold: {
    fontFamily: 'Inter_600SemiBold',
  },
});
