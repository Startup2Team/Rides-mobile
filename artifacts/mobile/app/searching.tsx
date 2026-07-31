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

// Mirrors MATCH_GIVE_UP_SECONDS on the API (default 90s). The grace window keeps
// the server authoritative: we only show a terminal state if its own give-up
// notification failed to arrive, rather than racing it.
const SEARCH_DEADLINE_SECONDS = 90;
const SEARCH_DEADLINE_GRACE_SECONDS = 5;

export default function SearchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, cancelRide, pauseDriverMatching, resumeDriverMatching } = useRide();
  const { showToast } = useToast();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  // Elapsed seconds, driving both the staged copy and the client deadline.
  //
  // This screen had no timeout of any kind: no elapsed indication, no stages, no
  // terminal state. If the backend never answered — and it frequently didn't,
  // because matching used to give up in milliseconds and publish `ride_cancelled`
  // before this screen's socket existed, so the message was dropped — the
  // customer sat on a pulsing animation indefinitely with Cancel as the only exit.
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Give the server SEARCH_DEADLINE_SECONDS plus a grace window before declaring
  // failure ourselves, so the backend stays authoritative and we only surface a
  // terminal state when its own give-up genuinely failed to reach us.
  const timedOut = elapsedSeconds >= SEARCH_DEADLINE_SECONDS + SEARCH_DEADLINE_GRACE_SECONDS;

  const searchStage = timedOut
    ? 'No drivers available right now'
    : elapsedSeconds < 20
      ? 'Finding your driver'
      : elapsedSeconds < 45
        ? 'Looking a bit wider…'
        : 'Still searching — drivers nearby may be busy';

  const finishCancelSearch = () => {
    cancelRide();
    showToast('Search cancelled', 'info');
    if (router.canGoBack()) {
      router.back();
    } else {
      navigateToCustomerHomeAfterCompletion(router);
    }
  };

  // Retry means: release this dead ride, then return home so the customer can
  // book again. Without cancelling first, the server-side active_ride pointer
  // would still be set and CreateRide would reject the next attempt.
  const handleRetry = () => {
    cancelRide();
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
          {timedOut
            ? 'No one accepted this time. You can try again — it often works on a second attempt.'
            : `Connecting you with nearby ${VEHICLE_LABELS[vehicleType].toLowerCase()} riders · ${elapsedSeconds}s`}
        </Text>

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
        {timedOut ? (
          <AppButton
            title="Try again"
            onPress={handleRetry}
            fullWidth
            size="lg"
          />
        ) : null}
        <AppButton
          title={timedOut ? 'Back to home' : 'Cancel Search'}
          onPress={handleCancel}
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
  },
});
