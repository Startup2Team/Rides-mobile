import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { VEHICLE_MAP_IMAGE_SIZE, VEHICLE_MAP_MARKER_IMAGES } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

interface VehicleMapMarkerProps {
  type: VehicleType;
  rotationDeg?: number;
  style?: ViewStyle;
}

/** Map marker artwork — expo-image for faithful colors vs source PNGs. */
export function VehicleMapMarker({ type, rotationDeg, style }: VehicleMapMarkerProps) {
  const dimensions = VEHICLE_MAP_IMAGE_SIZE[type];

  return (
    <View style={[styles.wrap, style]} accessibilityIgnoresInvertColor>
      <Image
        source={VEHICLE_MAP_MARKER_IMAGES[type]}
        style={[
          dimensions,
          rotationDeg != null ? { transform: [{ rotate: `${rotationDeg}deg` }] } : null,
        ]}
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
    width: 76,
    height: 76,
  },
});
