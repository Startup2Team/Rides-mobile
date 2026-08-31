import React from 'react';
import { AppPolyline } from '@/components/map';
import { APPLE_SYSTEM_RED_HEX } from '@/constants/systemColors';
import { Coords } from '@/types';

interface RoutePolylineProps {
  coordinates: Coords[];
  color?: string;
  width?: number;
}

/**
 * Renders a road-following polyline on the app map.
 * Pass the decoded coordinates from useRoute().route.coordinates.
 */
export function RoutePolyline({
  coordinates,
  color = APPLE_SYSTEM_RED_HEX.light,
  width = 4,
}: RoutePolylineProps) {
  if (coordinates.length < 2) return null;

  return (
    <AppPolyline
      coordinates={coordinates}
      color={color}
      width={width}
      lineCap="butt"
      lineJoin="round"
    />
  );
}
