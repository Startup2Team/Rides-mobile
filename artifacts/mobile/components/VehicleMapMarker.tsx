import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { VEHICLE_MAP_IMAGE_SIZE, VEHICLE_MAP_MARKER_IMAGES } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

interface VehicleMapMarkerProps {
  compact?: boolean;
  type: VehicleType;
  rotationDeg?: number;
  style?: ViewStyle;
}

/** Map marker artwork — expo-image for faithful colors vs source PNGs. */
export function VehicleMapMarker({ compact = false, type, rotationDeg, style }: VehicleMapMarkerProps) {
  const baseDimensions = VEHICLE_MAP_IMAGE_SIZE[type];
  const dimensions = compact
    ? { width: baseDimensions.width * 0.55, height: baseDimensions.height * 0.55 }
    : baseDimensions;

  return (
    <View
      style={[
        styles.wrap,
        compact && {
          alignItems: 'flex-start',
          width: dimensions.width,
          height: dimensions.height,
        },
        style,
      ]}
      accessibilityIgnoresInvertColors
    >
      <Image
        source={VEHICLE_MAP_MARKER_IMAGES[type]}
        style={[
          dimensions,
          rotationDeg != null ? { transform: [{ rotate: `${rotationDeg}deg` }] } : null,
        ]}
        contentFit="contain"
        accessibilityIgnoresInvertColors
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
