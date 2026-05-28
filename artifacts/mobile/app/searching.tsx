import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KandaButton } from '@/components/KandaButton';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { showCancelSearchAlert } from '@/utils/cancelSearchAlert';
import { VEHICLE_LABELS, VehicleType } from '@/types';

const VEHICLE_IMAGES: Record<VehicleType, any> = {
  moto: require('../assets/vehicle-markers/moto.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

const VEHICLE_IMAGE_STYLES: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 66, height: 50 },
  cab: { width: 62, height: 46 },
  hilux: { width: 70, height: 46 },
  fuso: { width: 72, height: 48 },
};

export default function SearchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, cancelRide, pauseDriverMatching, resumeDriverMatching, isMatchingPaused } = useRide();
  const isCancellingRef = useRef(false);

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

  useEffect(() => {
    if (currentRide?.status === 'negotiating' && !isMatchingPaused) {
      router.replace('/negotiation');
    } else if (!isCancellingRef.current && (!currentRide || currentRide.status === 'cancelled')) {
      router.replace('/(tabs)');
    }
  }, [currentRide?.status, isMatchingPaused]);

  const finishCancelSearch = () => {
    isCancellingRef.current = true;
    cancelRide();
    router.replace('/(tabs)');
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

        <View style={[styles.centerDot, { backgroundColor: colors.primary }]}>
          <Image
            source={VEHICLE_IMAGES[vehicleType]}
            style={[styles.vehicleImage, VEHICLE_IMAGE_STYLES[vehicleType]]}
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
          <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        <KandaButton
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
    shadowColor: '#00C853',
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
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1,
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
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
});
