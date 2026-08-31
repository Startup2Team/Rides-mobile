import Mapbox from '@rnmapbox/maps';
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { Coords } from '@/types';
import { boundsFromCoordinates, regionToZoomLevel } from './geo';
import type { AppMapHandle, AppMapProps, AppMapType } from './types';

// pk.* tokens are public client tokens — safe to embed in the bundle.
// Same env var + value already used for Mapbox Directions (services/mapbox.ts).
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const DEFAULT_ANIMATION_MS = 500;

function styleUrlForMapType(mapType: AppMapType): string {
  switch (mapType) {
    case 'satellite':
      return Mapbox.StyleURL.Satellite;
    case 'hybrid':
      return Mapbox.StyleURL.SatelliteStreet;
    case 'standard':
    default:
      // Closest built-in stand-in for the app's custom navy Google style —
      // porting that exact palette needs a Mapbox Studio custom style
      // (design task, out of scope for this migration).
      return Mapbox.StyleURL.Dark;
  }
}

function toLngLat(coord: Coords): [number, number] {
  return [coord.longitude, coord.latitude];
}

export const AppMapMapbox = forwardRef<AppMapHandle, AppMapProps>(function AppMapMapbox(
  { initialRegion, mapType = 'standard', style, onMapReady, onLayout, onPanDrag, onRegionChangeComplete, children },
  ref,
) {
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  const defaultCameraSettings = useMemo(
    () => ({
      centerCoordinate: toLngLat(initialRegion),
      zoomLevel: regionToZoomLevel(initialRegion.longitudeDelta),
    }),
    // Intentionally captured once — mirrors react-native-maps `initialRegion`,
    // which is also only applied on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates, options) => {
      if (coordinates.length === 0) return;
      const duration = options.animated === false ? 0 : DEFAULT_ANIMATION_MS;
      if (coordinates.length === 1) {
        cameraRef.current?.setCamera({ centerCoordinate: toLngLat(coordinates[0]), animationDuration: duration });
        return;
      }
      const { ne, sw } = boundsFromCoordinates(coordinates);
      const { top, right, bottom, left } = options.edgePadding;
      cameraRef.current?.fitBounds(toLngLat(ne), toLngLat(sw), [top, right, bottom, left], duration);
    },
    animateToRegion: (region, durationMs = DEFAULT_ANIMATION_MS) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [region.longitude, region.latitude],
        zoomLevel: regionToZoomLevel(region.longitudeDelta),
        animationDuration: durationMs,
      });
    },
    coordinateForPoint: async point => {
      const position = await mapViewRef.current?.getCoordinateFromView([point.x, point.y]);
      const [longitude, latitude] = position ?? [initialRegion.longitude, initialRegion.latitude];
      return { latitude, longitude };
    },
  }), [initialRegion.latitude, initialRegion.longitude]);

  return (
    <Mapbox.MapView
      ref={mapViewRef}
      style={style ?? StyleSheet.absoluteFill}
      styleURL={styleUrlForMapType(mapType)}
      scaleBarEnabled={false}
      attributionPosition={{ bottom: 4, left: 4 }}
      logoPosition={{ bottom: 4, right: 4 }}
      onLayout={onLayout}
      onDidFinishLoadingMap={onMapReady}
      onRegionWillChange={feature => {
        if (feature.properties.isUserInteraction) onPanDrag?.();
      }}
      onRegionDidChange={feature => {
        if (!onRegionChangeComplete) return;
        const [longitude, latitude] = feature.geometry.coordinates;
        const longitudeDelta = 360 / 2 ** feature.properties.zoomLevel;
        onRegionChangeComplete({
          latitude,
          longitude,
          longitudeDelta,
          // Mercator tiles are square in projected space; using the same
          // value keeps this internally consistent for our (delta-agnostic)
          // callers.
          latitudeDelta: longitudeDelta,
        });
      }}
    >
      <Mapbox.Camera ref={cameraRef} defaultSettings={defaultCameraSettings} />
      {children}
    </Mapbox.MapView>
  );
});
