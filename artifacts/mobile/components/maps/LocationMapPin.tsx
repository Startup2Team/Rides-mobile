import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type LocationMapPinVariant = 'pickup' | 'destination';
export type LocationMapPinMapType = 'standard' | 'satellite' | 'hybrid';

export const LOCATION_MAP_PIN_SIZE = 48;

/** Rendered pin height for a given size — stem tip sits at the bottom edge of this box. */
export function getLocationMapPinHeight(size = LOCATION_MAP_PIN_SIZE): number {
  const headSize = Math.round(size * 0.34);
  const stemHeight = Math.round(size * 0.44);
  return headSize + stemHeight - 1;
}

/** Bottom-center of the pin view = stem tip = exact map coordinate. Do not pair with centerOffset. */
export const LOCATION_MAP_PIN_ANCHOR = { x: 0.5, y: 1 } as const;

interface LocationMapPinProps {
  variant: LocationMapPinVariant;
  size?: number;
  mapType?: LocationMapPinMapType;
}

/** Lollipop map pin: circle head + stem with pointed tip. */
export function LocationMapPin({
  variant,
  size = LOCATION_MAP_PIN_SIZE,
  mapType = 'standard',
}: LocationMapPinProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const color = variant === 'pickup' ? colors.primaryHex : colors.successHex;
  const isLightStandard = scheme !== 'dark' && mapType === 'standard';
  const stemColor = isLightStandard ? '#6B7280' : '#FFFFFF';
  const stemBorderColor = isLightStandard ? 'transparent' : 'rgba(0,0,0,0.65)';
  const headSize = Math.round(size * 0.34);
  const headRingWidth = Math.max(3, Math.round(headSize * 0.24));
  const stemWidth = Math.max(3, Math.round(size * 0.06));
  const stemHeight = Math.round(size * 0.44);
  const stemJoinOverlap = 1;
  const pinHeight = headSize + stemHeight;

  return (
    <View style={[styles.root, { width: size, height: pinHeight }]}>
      <View
        style={[
          styles.head,
          {
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            backgroundColor: 'transparent',
            borderWidth: headRingWidth,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.stem,
          {
            width: stemWidth,
            height: stemHeight,
            backgroundColor: stemColor,
            borderColor: stemBorderColor,
            marginTop: -stemJoinOverlap,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stem: {
    borderRadius: 999,
    borderWidth: 0.5,
  },
});
