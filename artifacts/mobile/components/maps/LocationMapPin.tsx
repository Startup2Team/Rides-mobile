import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useMarkerAppear } from '@/hooks/map/useMarkerAppear';

export type LocationMapPinVariant = 'pickup' | 'destination';
export type LocationMapPinMapType = 'standard' | 'satellite' | 'hybrid';

export const LOCATION_MAP_PIN_SIZE = 48;

/** Rendered pin height for a given size — flat stem foot sits on the bottom edge. */
export function getLocationMapPinHeight(size = LOCATION_MAP_PIN_SIZE): number {
  const headSize = Math.round(size * 0.34);
  const stemHeight = Math.round(size * 0.44);
  return headSize + stemHeight;
}

/** Map coordinate = flat foot of the stem (0 cm), not the stem top (2 cm) under the ring. */
export const LOCATION_MAP_PIN_ANCHOR = { x: 0.5, y: 1 } as const;

/**
 * Custom marker views are often centered on the coordinate; shift up by half the pin height
 * so the route meets the bottom of the stem, not the stem–head join.
 */
export function getLocationMapPinCenterOffset(
  size = LOCATION_MAP_PIN_SIZE,
): { x: number; y: number } {
  return { x: 0, y: -getLocationMapPinHeight(size) / 2 };
}

interface LocationMapPinProps {
  variant: LocationMapPinVariant;
  size?: number;
  mapType?: LocationMapPinMapType;
}

/** Lollipop map pin: ring head + stem; route meets the flat stem foot on the coordinate. */
export function LocationMapPin({
  variant,
  size = LOCATION_MAP_PIN_SIZE,
  mapType = 'standard',
}: LocationMapPinProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const appearStyle = useMarkerAppear();
  const color = variant === 'pickup' ? colors.primaryHex : colors.successHex;
  const isLightStandard = scheme !== 'dark' && mapType === 'standard';
  const stemColor = isLightStandard ? '#6B7280' : '#FFFFFF';
  const stemBorderColor = isLightStandard ? 'transparent' : 'rgba(0,0,0,0.65)';
  const headSize = Math.round(size * 0.34);
  const headRingWidth = Math.max(3, Math.round(headSize * 0.24));
  const stemWidth = Math.max(3, Math.round(size * 0.06));
  const stemHeight = Math.round(size * 0.44);
  const stemJoinOverlap = 1;
  const stemFootRadius = stemWidth / 2;
  const pinHeight = headSize + stemHeight;

  return (
    <Reanimated.View
      style={[styles.root, { width: size, height: pinHeight }, appearStyle]}
      collapsable={false}
    >
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
            borderTopLeftRadius: stemFootRadius,
            borderTopRightRadius: stemFootRadius,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          },
        ]}
      />
    </Reanimated.View>
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
    borderWidth: 0.5,
  },
});
