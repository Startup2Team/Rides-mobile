import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface RouteTimelineProps {
  /** Tighter spacing for list cards (My Rides). */
  compact?: boolean;
}

/** Pickup (blue circle) → dropoff (red square), consistent with map and booking UI. */
export function RouteTimeline({ compact = false }: RouteTimelineProps) {
  const colors = useColors();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityElementsHidden>
      <View style={[styles.pickupDot, { backgroundColor: colors.primary }]} />
      <View style={[styles.line, compact && styles.lineCompact, { backgroundColor: colors.border }]} />
      <View style={[styles.dropoffDot, { backgroundColor: colors.destructive }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  wrapCompact: {
    paddingVertical: 2,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 1.5,
    height: 22,
  },
  lineCompact: {
    height: 20,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
