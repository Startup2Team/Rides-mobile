import React from 'react';
import { Polyline } from 'react-native-maps';
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
  color = '#FF3B30',
  width = 4,
}: RoutePolylineProps) {
  if (coordinates.length < 2) return null;

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={color}
      strokeWidth={width}
      lineCap="round"
      lineJoin="round"
    />
  );
}
