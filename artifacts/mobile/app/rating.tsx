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
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { APP_NAME } from '@/constants/branding';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { type DriverRatingStars } from '@/domain/driverWallet';
import { reportOperationalFailure } from '@/observability/monitoring';
import { buildLocalDriverRating, saveDriverRatingOnce } from '@/persistence/driverRatingPersistence';
import { typography } from '@/constants/typography';
import { elevation } from '@/constants/elevation';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { navigateToCustomerHomeAfterCompletion } from '@/navigation/navigationPolicy';
import {
  isUploadedProfileImageUri,
  resolveDriverProfileImage,
} from '@/utils/driverProfileImage';

const CARD_MAX_WIDTH = 320;
const DRIVER_ICON_SIZE = sizes.avatar.xl;

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
  const { user } = useAuth();
  const { currentRide, rideHistory, completeRide } = useRide();
  const params = useLocalSearchParams<{
    rideId?: string;
    driverName?: string;
    driverPhoto?: string;
    fare?: string;
    vehicleType?: string;
  }>();

  const [phase, setPhase] = useState<RatingPhase>('rate');
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ratingSavedRef = useRef(false);

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
    const paramPhoto =
      typeof params.driverPhoto === 'string' && isUploadedProfileImageUri(params.driverPhoto)
        ? params.driverPhoto.trim()
        : undefined;
    return paramPhoto ?? resolveDriverProfileImage(ratedRide?.driver);
  }, [params.driverPhoto, ratedRide?.driver]);

  const finalizeRide = () => {
    if (finalizedRideRef.current || !currentRide) return;
    finalizedRideRef.current = true;
    completeRide();
  };

  const returnToHome = () => {
    navigateToCustomerHomeAfterCompletion(router);
    queueMicrotask(finalizeRide);
  };

  const persistRating = async () => {
    if (ratingSavedRef.current || stars < 1 || stars > 5) return;
    const driverId = ratedRide?.driverId ?? ratedRide?.driver?.id;
    if (!ratedRide?.id || !driverId) return;

    try {
      await saveDriverRatingOnce(buildLocalDriverRating({
        comment: review,
        customerId: ratedRide.customerId ?? user?.id,
        driverId,
        rideId: ratedRide.id,
        stars: stars as DriverRatingStars,
      }));
      ratingSavedRef.current = true;
    } catch (error) {
      reportOperationalFailure('driver.rating.persist', error, { rideId: ratedRide.id, driverId });
    }
  };

  const finishAndExit = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await persistRating();

    if (rideHistory.length >= 3) {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) await StoreReview.requestReview();
    }

    returnToHome();
  };

  const exitToHome = () => {
    returnToHome();
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

  const driverInitial =
    (ratedRide?.driver?.name ?? driverName).trim()?.[0]?.toUpperCase() ?? '?';

  const canRateSubmit = stars > 0 && !submitting;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BlurView intensity={48} tint={glassTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]} />
      </View>

      {phase === 'review' ? (
        <KeyboardAwareScrollViewCompat
          style={styles.keyboardScroll}
          contentContainerStyle={[
            styles.keyboardScrollContent,
            {
              paddingTop: insets.top + (Platform.OS === 'web' ? 67 : spacing[0]) + semanticSpacing.rowGap,
              paddingBottom: insets.bottom + semanticSpacing.comfortableGap,
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
            <ProfileAvatarCircle
              size={DRIVER_ICON_SIZE}
              initial={driverInitial}
              imageUri={driverPhotoUri ?? null}
              style={styles.driverAvatar}
              accessibilityLabel={`${driverName} profile photo`}
            />

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
    paddingHorizontal: spacing[28],
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
    paddingHorizontal: spacing[28],
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: radius.sheetCompact,
    paddingBottom: spacing[4],
    paddingHorizontal: semanticSpacing.screenPadding,
    alignItems: 'center',
    ...elevation.modal,
    shadowOpacity: 0.28,
    elevation: 24,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  thanksCard: {
    paddingTop: spacing[20],
  },
  reviewCard: {
    paddingTop: spacing[20],
  },
  driverAvatar: {
    marginBottom: spacing[14],
    alignSelf: 'center',
  },
  title: {
    ...typography.title,
    fontFamily: typography.title.fontFamily,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.label,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing[6],
    marginBottom: 18,
    paddingHorizontal: spacing[4],
  },
  thanksSubtitle: {
    marginBottom: spacing[14],
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[6],
    marginBottom: 18,
  },
  starLarge: {
    ...typography.displayXL,
    lineHeight: 44,
  },
  starMedium: {
    ...typography.display,
    lineHeight: 36,
  },
  reviewInput: {
    alignSelf: 'stretch',
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: semanticSpacing.rowGap,
    paddingTop: spacing[10],
    paddingBottom: spacing[10],
    ...typography.bodySmall,
    lineHeight: 20,
    marginBottom: semanticSpacing.comfortableGap,
  },
  divider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing[4],
  },
  actionsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: sizes.iconButton.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: semanticSpacing.rowGap,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: semanticSpacing.inlineGap,
  },
  actionText: {
    ...typography.title,
  },
  actionTextBold: {
    fontFamily: typography.title.fontFamily,
  },
});
