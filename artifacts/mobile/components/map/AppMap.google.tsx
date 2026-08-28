import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { GOOGLE_DARK_MAP_STYLE } from './googleDarkMapStyle';
import type { AppMapHandle, AppMapProps, AppMapType } from './types';

function googleMapType(mapType: AppMapType): 'standard' | 'satellite' | 'hybrid' {
  return mapType;
}

/**
 * react-native-maps (Google Maps on Android, Apple Maps on iOS) implementation
 * of the map abstraction. Kept fully working so flipping
 * EXPO_PUBLIC_MAP_PROVIDER=google switches the app back to it — see
 * components/map/README.md.
 */
export const AppMapGoogle = forwardRef<AppMapHandle, AppMapProps>(function AppMapGoogle(
  { initialRegion, mapType = 'standard', style, onMapReady, onLayout, onPanDrag, onRegionChangeComplete, children },
  ref,
) {
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates, options) => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: options.edgePadding,
        animated: options.animated ?? true,
      });
    },
    animateToRegion: (region, durationMs) => {
      mapRef.current?.animateToRegion(region, durationMs);
    },
    coordinateForPoint: async point => {
      const coord = await mapRef.current?.coordinateForPoint(point);
      if (!coord) throw new Error('Map is not ready');
      return coord;
    },
  }), []);

  return (
    <MapView
      ref={mapRef}
      style={style ?? StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      mapType={googleMapType(mapType)}
      customMapStyle={mapType === 'standard' ? GOOGLE_DARK_MAP_STYLE : undefined}
      showsUserLocation={false}
      showsMyLocationButton={false}
      onMapReady={onMapReady}
      onLayout={onLayout}
      onPanDrag={onPanDrag}
      onRegionChangeComplete={onRegionChangeComplete as (region: Region) => void}
    >
      {children}
    </MapView>
  );
});
