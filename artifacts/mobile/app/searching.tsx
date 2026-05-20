import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KandaButton } from '@/components/KandaButton';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';

export default function SearchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, cancelRide } = useRide();

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();

    animate(ring1, 0);
    animate(ring2, 500);
    animate(ring3, 1000);
  }, []);

  // Navigate when driver is found
  useEffect(() => {
    if (currentRide?.status === 'negotiating') {
      router.replace('/negotiation');
    } else if (!currentRide || currentRide.status === 'cancelled') {
      router.replace('/(tabs)/');
    }
  }, [currentRide?.status]);

  const handleCancel = () => {
    cancelRide();
    router.replace('/(tabs)/');
  };

  const ringScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] });
  const ringOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });

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
      {/* Pulsing animation */}
      <View style={styles.pulseArea}>
        {[ring1, ring2, ring3].map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                borderColor: colors.primary,
                transform: [{ scale: ringScale(anim) }],
                opacity: ringOpacity(anim),
              },
            ]}
          />
        ))}
        <View style={[styles.centerDot, { backgroundColor: colors.primary }]}>
          <Text style={styles.centerEmoji}>🏍</Text>
        </View>
      </View>

      <View style={styles.textArea}>
        <Text style={[styles.title, { color: colors.foreground }]}>Finding your driver</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Connecting you with nearby{' '}
          {currentRide?.vehicleType === 'moto'
            ? 'moto riders'
            : currentRide?.vehicleType === 'cab'
            ? 'cab drivers'
            : 'drivers'}
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
              <View style={[styles.routeDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                {currentRide.destination.address ?? 'Destination'}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        <KandaButton
          title="Cancel Search"
          onPress={handleCancel}
          variant="outline"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  pulseArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  centerDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  centerEmoji: { fontSize: 36 },
  textArea: { width: '100%', paddingHorizontal: 24, gap: 12, paddingBottom: 32 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 1, marginLeft: 20 },
  routeText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  bottom: { width: '100%', paddingHorizontal: 24, paddingBottom: 32 },
});
