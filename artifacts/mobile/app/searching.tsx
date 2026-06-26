import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { useToast } from '@/context/ToastContext';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { showCancelSearchAlert } from '@/utils/cancelSearchAlert';
import {
  VEHICLE_MAP_MARKER_IMAGES,
  VEHICLE_SEARCHING_IMAGE_SIZE,
} from '@/constants/vehicles';
import { VEHICLE_LABELS } from '@/types';
import { typography } from '@/constants/typography';

export default function SearchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, cancelRide, pauseDriverMatching, resumeDriverMatching } = useRide();
  const { showToast } = useToast();

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
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulse(pulseA, 0);
    startPulse(pulseB, 500);
    startPulse(pulseC, 1000);
  }, [pulseA, pulseB, pulseC]);

  const finishCancelSearch = () => {
    cancelRide();
    showToast('Search cancelled', 'info');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
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
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
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
        <Text style={[styles.title, { color: colors.foreground }]}>Finding your driver</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Connecting you with nearby {VEHICLE_LABELS[vehicleType].toLowerCase()} riders
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
        <AppButton
          title="Cancel Search"
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
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    height: 1,
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
