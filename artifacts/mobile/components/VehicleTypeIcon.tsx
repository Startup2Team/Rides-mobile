import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VEHICLE_CHIP_IMAGE_SIZE, VEHICLE_MARKER_IMAGES } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

interface VehicleTypeIconProps {
  type: VehicleType;
  selected?: boolean;
}

export function VehicleTypeIcon({ type, selected = false }: VehicleTypeIconProps) {
  const dimensions = VEHICLE_CHIP_IMAGE_SIZE[type];

  return (
    <View style={styles.wrap} accessibilityIgnoresInvertColor>
      <Image
        source={VEHICLE_MARKER_IMAGES[type]}
        style={[dimensions, selected ? styles.selected : styles.unselected]}
        contentFit="contain"
        accessibilityIgnoresInvertColor
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    opacity: 1,
  },
  unselected: {
    opacity: 0.88,
  },
});
