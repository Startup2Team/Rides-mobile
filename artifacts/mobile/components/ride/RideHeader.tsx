import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '@/components/StatusChip';
import type { Ride } from '@/types';
import type { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';

export function RideHeader({
  colors,
  etaText,
  isElevated,
  ride,
  safeAreaTop,
  statusMessage,
}: {
  colors: ReturnType<typeof useColors>;
  etaText: string | null;
  isElevated: boolean;
  ride: Ride;
  safeAreaTop: number;
  statusMessage: string;
}) {
  return (
    <View style={[styles.container, isElevated && styles.shadow, {
      paddingTop: safeAreaTop + (Platform.OS === 'web' ? 67 : 0) + 12,
      backgroundColor: colors.background,
    }]}>
      <View style={styles.bar}>
        <View style={styles.slot}><StatusChip status={ride.status} variant="rideHeader" /></View>
        <View style={[styles.slot, styles.end]}>
          {ride.driver && etaText ? <Text style={[styles.eta, { color: colors.primary }]} numberOfLines={1}>{etaText}</Text> : null}
        </View>
        <View style={styles.titleOverlay} pointerEvents="none">
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {statusMessage}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 14, zIndex: 10 },
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 32, position: 'relative' },
  slot: { flex: 1, minWidth: 0, zIndex: 1, justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  titleOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 76, zIndex: 0 },
  title: { maxWidth: '100%', ...typography.label, fontFamily: typography.title.fontFamily, textAlign: 'center', lineHeight: 17 },
  eta: { ...typography.caption, fontFamily: typography.badge.fontFamily, textAlign: 'right' },
});
