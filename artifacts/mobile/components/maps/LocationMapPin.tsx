import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type LocationMapPinVariant = 'pickup' | 'destination';

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
}

/** Lollipop map pin: circle head + stem with pointed tip. */
export function LocationMapPin({ variant, size = LOCATION_MAP_PIN_SIZE }: LocationMapPinProps) {
  const colors = useColors();
  const color = variant === 'pickup' ? colors.primaryHex : colors.destructiveHex;
  const headSize = Math.round(size * 0.5);
  const headInnerSize = Math.round(headSize * 0.48);
  const stemWidth = Math.max(3, Math.round(size * 0.06));
  const stemHeight = Math.round(size * 0.44);
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
            backgroundColor: color,
          },
        ]}
      >
        <View
          style={[
            styles.headInner,
            {
              width: headInnerSize,
              height: headInnerSize,
              borderRadius: headInnerSize / 2,
              backgroundColor: colors.card,
            },
          ]}
        />
      </View>
      <View style={[styles.stem, { width: stemWidth, height: stemHeight }]} />
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
  },
  headInner: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  stem: {
    borderRadius: 999,
    backgroundColor: '#000000',
  },
});
