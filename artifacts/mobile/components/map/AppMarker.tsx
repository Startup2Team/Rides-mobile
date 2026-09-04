import React from 'react';
import { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import type { AppMarkerProps } from './types';

let Mapbox: typeof import('@rnmapbox/maps').default | null = null;
if (MAP_PROVIDER === 'mapbox') {
  try {
    Mapbox = require('@rnmapbox/maps').default;
  } catch (e) {
    console.warn('[AppMarker] Mapbox native module unavailable');
  }
}

/**
 * A marker anchored to a map coordinate, rendering arbitrary React children
 * (VehicleMapMarker, LocationMapPin, CustomerLocationMarker, ...) as its
 * visual — same contract on both providers.
 */
export function AppMarker({
  coordinate,
  anchor,
  centerOffset,
  zIndex,
  identifier,
  title,
  description,
  accessibilityLabel,
  tracksViewChanges,
  children,
}: AppMarkerProps) {
  if (MAP_PROVIDER === 'google' || !Mapbox) {
    return (
      <Marker
        identifier={identifier}
        coordinate={coordinate}
        anchor={anchor}
        centerOffset={centerOffset}
        zIndex={zIndex}
        title={title}
        description={description}
        accessibilityLabel={accessibilityLabel}
        tracksViewChanges={tracksViewChanges}
      >
        {children}
      </Marker>
    );
  }

  return (
    <Mapbox.MarkerView
      id={identifier}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor ? { x: anchor.x, y: anchor.y } : undefined}
      allowOverlap
    >
      <>{children}</>
    </Mapbox.MarkerView>
  );
}
