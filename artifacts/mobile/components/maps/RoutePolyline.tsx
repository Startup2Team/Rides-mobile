import React from 'react';
import { Polyline } from 'react-native-maps';
import { APPLE_SYSTEM_RED_HEX } from '@/constants/systemColors';
import { Coords } from '@/types';

interface RoutePolylineProps {
  coordinates: Coords[];
  color?: string;
  width?: number;
}

/**
 * Renders a road-following polyline on a react-native-maps MapView.
 * Pass the decoded coordinates from useRoute().route.coordinates.
 */
export function RoutePolyline({
  coordinates,
  color = APPLE_SYSTEM_RED_HEX.light,
  width = 4,
}: RoutePolylineProps) {
  if (coordinates.length < 2) return null;

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={color}
      strokeWidth={width}
      lineCap="butt"
      lineJoin="round"
    />
  );
}
