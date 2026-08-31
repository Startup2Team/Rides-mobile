import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import type { AppMarkerProps } from './types';

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
  if (MAP_PROVIDER === 'google') {
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
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor}
      accessibilityLabel={accessibilityLabel}
    >
      {children as React.ReactElement}
    </Mapbox.MarkerView>
  );
}
