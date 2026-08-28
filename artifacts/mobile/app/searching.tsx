import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/context/ToastContext';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { duration } from '@/constants/motion';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { showCancelSearchAlert } from '@/utils/cancelSearchAlert';
import { navigateToCustomerHomeAfterCompletion } from '@/navigation/navigationPolicy';
import {
  VEHICLE_MAP_MARKER_IMAGES,
  VEHICLE_SEARCHING_IMAGE_SIZE,
} from '@/constants/vehicles';
import { VEHICLE_LABELS } from '@/types';
import { typography } from '@/constants/typography';

// Fallback search budget when the create-ride response carries no
// give_up_seconds / search_deadline_at (those fields are rolling out on the API
// in parallel — when present they override this). The grace window keeps the
// server authoritative: we only show a terminal state if its own give-up
// notification failed to arrive, rather than racing it. RideProvider holds a
// last-resort reaper well behind this (CUSTOMER_SEARCH_TIMEOUT_MS) for searches
// abandoned off-screen — it must never fire before this in-place state does.
const SEARCH_DEADLINE_SECONDS = 60;
const SEARCH_DEADLINE_GRACE_SECONDS = 5;

export default function SearchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    currentRide,
    cancelRide,
    createRide,
    cancelledSearchDraft,
    pauseDriverMatching,
    resumeDriverMatching,
  } = useRide();
  const { showToast } = useToast();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const searchStartedAtRef = useRef(Date.now());

  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const pulseC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startPulse = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration.instant,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulse(pulseA, 0);
    startPulse(pulseB, 500);
    startPulse(pulseC, 1000);
  }, [pulseA, pulseB, pulseC]);

  // Elapsed seconds (Date.now() delta so a backgrounded app stays honest),
  // driving both the staged copy and the countdown. Keyed on the ride id so a
  // Try-again restarts the clock with the fresh search.
  useEffect(() => {
    searchStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - searchStartedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [currentRide?.id]);

  // Total budget this search actually has: the server's own deadline when the
  // create response carried one (absolute timestamp preferred over the plain
  // seconds grant), else the local fallback. The countdown renders budget → 0.
  const budgetSeconds = useMemo(() => {
    const deadlineAt = currentRide?.searchDeadlineAt;
    if (deadlineAt) {
      const delta = Math.round((new Date(deadlineAt).getTime() - searchStartedAtRef.current) / 1000);
      if (Number.isFinite(delta) && delta > 0) return delta;
    }
    const granted = currentRide?.searchBudgetSeconds;
    if (granted && granted > 0) return granted;
    return SEARCH_DEADLINE_SECONDS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRide?.id, currentRide?.searchBudgetSeconds, currentRide?.searchDeadlineAt]);

  const remainingSeconds = Math.max(0, budgetSeconds - elapsedSeconds);

  // Give the server its full budget plus a grace window before declaring
  // failure ourselves, so the backend stays authoritative and we only surface a
  // terminal state when its own give-up genuinely failed to reach us. When the
  // give-up DOES arrive, RideProvider marks the ride (searchOutcome) instead of
  // popping the screen, and this same in-place state shows immediately.
  const timedOut = elapsedSeconds >= budgetSeconds + SEARCH_DEADLINE_GRACE_SECONDS;
  const searchFailed = currentRide?.searchOutcome === 'no_drivers' || timedOut;

  const searchStage = searchFailed
    ? 'No drivers available right now'
    // The first threshold tracks the API's wave cadence
    // (MATCH_WAVE_INTERVAL_SECONDS=12, 2km first ring widening out); the rest
    // key off REMAINING time so the copy stays truthful whatever budget the
    // server granted — including the final "all asked, waiting" stage.
    : elapsedSeconds < 12
      ? 'Finding your driver'
      : remainingSeconds > budgetSeconds * 0.4
        ? 'Looking a bit wider…'
        : remainingSeconds > 10
          ? 'Still searching — drivers nearby may be busy'
          : "We've asked all nearby riders — waiting for one to free up";

  const finishCancelSearch = async () => {
    // cancelRide already surfaces its own Alert and leaves the search running
    // on a backend rejection — only leave the screen once it actually
    // confirmed.
    if (!(await cancelRide())) return;
    showToast('Search cancelled', 'info');
    if (router.canGoBack()) {
      router.back();
    } else {
      navigateToCustomerHomeAfterCompletion(router);
    }
  };

  // Try again re-books the SAME trip (pickup/destination/vehicle from the saved
  // booking draft, falling back to the failed ride itself). createRide swaps in
  // a fresh 'searching' ride synchronously — this screen never unmounts — and
  // it releases any backend ride the dead search still holds BEFORE the new
  // POST, so the retry cannot be rejected as RIDE_ALREADY_ACTIVE.
  const handleRetry = () => {
    const draft = cancelledSearchDraft;
    const failedRide = currentRide;
    if (draft) {
      void createRide(draft.pickup, draft.destination, draft.vehicleType, draft.destText);
    } else if (failedRide) {
      void createRide(
        failedRide.pickup,
        failedRide.destination,
        failedRide.requestedVehicleType ?? failedRide.vehicleType,
        failedRide.destination.address ?? '',
      );
    } else {
      navigateToCustomerHomeAfterCompletion(router);
    }
  };

  // In the failed state there is nothing left to confirm — the search already
  // ended (searchOutcome is already showing the truth on this screen) — so
  // leave directly instead of raising the cancel-search alert. cancelRide is
  // best-effort cleanup here (a stale backendRideId the give-up reaper hasn't
  // swept yet), not a claim that a still-live ride got cancelled, so
  // navigation must not wait on it or block if the backend says there was
  // nothing left to cancel.
  const handleBackHome = () => {
    void cancelRide();
    navigateToCustomerHomeAfterCompletion(router);
  };

  const handleCancel = () => {
    showCancelSearchAlert(finishCancelSearch, {
      onPauseMatching: pauseDriverMatching,
      onResumeMatching: resumeDriverMatching,
    });
  };

  const pulseStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.25, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 2],
        }),
      },
    ],
  });

  const destinationLabel = useMemo(() => {
    const destination = currentRide?.destination;
    if (!destination) return 'Destination';
    return destination.locationType === 'generic'
      ? 'To be confirmed in chat'
      : destination.address ?? 'Destination';
  }, [currentRide?.destination]);

  const vehicleType = currentRide?.vehicleType ?? 'moto';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : spacing[0]),
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : spacing[0]),
        },
      ]}
    >
      <View style={styles.pulseArea}>
        {[pulseA, pulseB, pulseC].map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.pulseRing,
              {
                borderColor: colors.primary,
              },
              pulseStyle(anim),
            ]}
          />
        ))}

        <View style={[styles.centerDot, { backgroundColor: colors.primary, shadowColor: colors.primaryHex }]}>
          <Image
            source={VEHICLE_MAP_MARKER_IMAGES[vehicleType]}
            style={[styles.vehicleImage, VEHICLE_SEARCHING_IMAGE_SIZE[vehicleType]]}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>{searchStage}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {searchFailed
            ? currentRide?.searchFailureReason ??
              'No one accepted this time. You can try again — it often works on a second attempt.'
            : `Connecting you with nearby ${VEHICLE_LABELS[vehicleType].toLowerCase()} riders`}
        </Text>
        {!searchFailed && (
          <View
            style={styles.countdownRow}
            accessibilityRole="text"
            accessibilityLabel={`${remainingSeconds} seconds left in this search`}
          >
            <Text style={[styles.countdownValue, { color: colors.primary }]}>{remainingSeconds}</Text>
            <Text style={[styles.countdownUnit, { color: colors.mutedForeground }]}>s</Text>
          </View>
        )}

        {currentRide && (
          <View style={[styles.routeCard, { backgroundColor: colors.card }]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                {currentRide.pickup.address ?? 'Pickup'}
              </Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.dropoffDot, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                {destinationLabel}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {searchFailed ? (
          <AppButton
            title="Try again"
            onPress={handleRetry}
            fullWidth
            size="lg"
          />
        ) : null}
        <AppButton
          title={searchFailed ? 'Back to home' : 'Cancel Search'}
          onPress={searchFailed ? handleBackHome : handleCancel}
          variant="outline"
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  pulseArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  centerDot: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  vehicleImage: {
    zIndex: 2,
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    ...typography.h1,
    fontFamily: typography.badge.fontFamily,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    marginTop: spacing[4],
  },
  countdownValue: {
    ...typography.h1,
    fontVariant: ['tabular-nums'],
  },
  countdownUnit: {
    ...typography.body,
  },
  routeCard: {
    borderRadius: radius['2xl'],
    padding: semanticSpacing.listItemPadding,
    gap: semanticSpacing.inlineGap,
    marginTop: spacing[8],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dropoffDot: {
    borderRadius: 3,
  },
  routeLine: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
  },
  routeText: {
    flex: 1,
    ...typography.bodySmall,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: spacing[10],
  },
});
