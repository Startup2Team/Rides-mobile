import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type LocationMapPinVariant = 'pickup' | 'destination';

export const LOCATION_MAP_PIN_SIZE = 48;

/** Anchor so the pin tip (not the icon bounding box) sits on the map coordinate. */
export const LOCATION_MAP_PIN_ANCHOR = { x: 0.5, y: 1 } as const;

interface LocationMapPinProps {
  variant: LocationMapPinVariant;
  size?: number;
}

/** Teardrop map pin — blue pickup, red destination (matches map picker). */
export function LocationMapPin({ variant, size = LOCATION_MAP_PIN_SIZE }: LocationMapPinProps) {
  const colors = useColors();
  const color = variant === 'pickup' ? colors.primaryHex : colors.destructiveHex;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <MaterialCommunityIcons name="map-marker" size={size} color={color} style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  icon: {
    // Glyph includes transparent padding below the tip; nudge so the tip aligns with the view bottom.
    marginBottom: -2,
  },
});
