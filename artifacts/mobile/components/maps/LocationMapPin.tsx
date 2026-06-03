import React from 'react';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type LocationMapPinVariant = 'pickup' | 'destination';
export type LocationMapPinMapType = 'standard' | 'satellite' | 'hybrid';

export const LOCATION_MAP_PIN_SIZE = 48;
const LOCATION_MAP_PIN_HEAD_SIZE = Math.round(LOCATION_MAP_PIN_SIZE * 0.5);
const LOCATION_MAP_PIN_STEM_HEIGHT = Math.round(LOCATION_MAP_PIN_SIZE * 0.44);
const LOCATION_MAP_PIN_HEIGHT = LOCATION_MAP_PIN_HEAD_SIZE + LOCATION_MAP_PIN_STEM_HEIGHT;

/** Anchor so the pointed stem tip is the exact map coordinate. */
export const LOCATION_MAP_PIN_ANCHOR = { x: 0.5, y: 1 } as const;
/**
 * Custom marker views can still be centered internally by map SDKs.
 * Shift by half pin height so map coordinate lands at stem bottom tip.
 */
export const LOCATION_MAP_PIN_CENTER_OFFSET = Platform.select({
  ios: { x: 0, y: -(LOCATION_MAP_PIN_HEIGHT / 2) },
  android: { x: 0, y: -(LOCATION_MAP_PIN_HEIGHT / 2) },
  default: { x: 0, y: 0 },
}) as { x: number; y: number };

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
    justifyContent: 'flex-end',
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
