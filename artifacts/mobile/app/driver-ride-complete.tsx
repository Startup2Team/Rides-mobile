import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import type { VehicleType } from '@/types';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { useAuth } from '@/context/AuthContext';

const SCREEN_DURATION_MS = 3000;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FF4D4D', '#FF8C42', '#FFD700', '#AAFF00',
  '#00E5FF', '#00BFAE', '#7B61FF', '#FF61DC',
  '#FF9EBC', '#FFF176', '#B9F6CA', '#80D8FF',
];

type PieceShape = 'circle' | 'square' | 'diamond' | 'bar';
type ConfettiPiece = {
  left: number;
  startY: number;
  size: number;
  color: string;
  shape: PieceShape;
  rotation: number;
  duration: number;
  delay: number;
};

function createPieces(count = 160): ConfettiPiece[] {
  const shapes: PieceShape[] = ['circle', 'square', 'diamond', 'bar'];
  return Array.from({ length: count }, (_, i) => ({
    left: ((i * 0.618033) % 1) * SCREEN_WIDTH,
    startY: -(20 + (i % 10) * (SCREEN_HEIGHT / 10)),
    size: 5 + (i % 4) * 2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: shapes[i % shapes.length],
    rotation: (i * 47) % 360,
    duration: SCREEN_DURATION_MS * (0.7 + (i % 6) * 0.08),
    delay: (i % 16) * 60,
  }));
}

function ConfettiPieceView({ piece }: { piece: ConfettiPiece }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      useNativeDriver: true,
    }).start();
  }, [anim, piece.delay, piece.duration]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [piece.startY, piece.startY + SCREEN_HEIGHT + 80],
  });
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${piece.rotation}deg`, `${piece.rotation + 360}deg`],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.06, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.left,
          top: 0,
          width: piece.size,
          height: piece.shape === 'bar' ? piece.size * 2.5 : piece.size,
          backgroundColor: piece.color,
          borderRadius: piece.shape === 'circle' ? 999 : piece.shape === 'bar' ? 2 : piece.shape === 'square' ? 2 : 0,
          opacity,
          transform: [
            { translateY },
            { rotate },
            ...(piece.shape === 'diamond' ? [{ rotate: '45deg' as const }] : []),
          ],
        },
      ]}
    />
  );
}

export default function DriverRideCompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeRide } = useRide();
  const { recordCompletedRide, user } = useAuth();
  const { fare, driverId, driverName, vehicleType, recordFare } = useLocalSearchParams<{
    fare?: string;
    driverId?: string;
    driverName?: string;
    vehicleType?: string;
    recordFare?: string;
  }>();

  const pieces = useMemo(() => createPieces(), []);
  const earnedFare = fare ? parseInt(fare, 10) : null;
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    completeRide('driver', {
      driverId: driverId || user?.id,
      driverName: driverName || user?.name,
      vehicleType: (vehicleType as VehicleType) || undefined,
    });
    const fareNum = recordFare ? parseInt(recordFare, 10) : 0;
    if ((driverId || user?.id) && fareNum > 0) void recordCompletedRide(fareNum);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(driver)');
    }, SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {pieces.map((piece, i) => (
          <ConfettiPieceView key={i} piece={piece} />
        ))}
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Ride Complete!</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Great job, keep it up!</Text>
        {earnedFare != null && earnedFare > 0 && (
          <View style={styles.fareCard}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>You earned</Text>
            <Text style={[styles.fareAmount, { color: colors.primary }]}>
              {earnedFare.toLocaleString()} RWF
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 64 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  fareCard: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
  },
  fareLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  fareAmount: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  piece: { position: 'absolute' },
});
