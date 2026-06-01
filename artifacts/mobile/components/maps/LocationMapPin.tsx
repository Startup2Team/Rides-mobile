import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type LocationMapPinVariant = 'pickup' | 'destination';

export const LOCATION_MAP_PIN_SIZE = 48;

interface LocationMapPinProps {
  variant: LocationMapPinVariant;
  size?: number;
}

/** Teardrop map pin — blue pickup, red destination (matches map picker). */
export function LocationMapPin({ variant, size = LOCATION_MAP_PIN_SIZE }: LocationMapPinProps) {
  const colors = useColors();
  const color = variant === 'pickup' ? colors.primaryHex : colors.destructiveHex;

  return <MaterialCommunityIcons name="map-marker" size={size} color={color} />;
}
