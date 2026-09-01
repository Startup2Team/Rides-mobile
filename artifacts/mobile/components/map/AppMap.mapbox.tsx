import Mapbox from '@rnmapbox/maps';
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
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

/** Exported for unit tests — pure so it doesn't need a rendered MapView. */
export function styleUrlForMapType(mapType: AppMapType, colorScheme: 'light' | 'dark' | null | undefined): string {
  switch (mapType) {
    case 'satellite':
      return Mapbox.StyleURL.Satellite;
    case 'hybrid':
      return Mapbox.StyleURL.SatelliteStreet;
    case 'standard':
    default:
      // Clean light streets style by default — real dark-mode parity (not a
      // dark stand-in used everywhere) only when the device is in dark mode.
      return colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;
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
  const colorScheme = useColorScheme();
  // Annotations (MarkerView/ShapeSource children) added before the style has
  // finished loading can end up positioned incorrectly until the next camera
  // move recomputes them — the "marker only appears after a scroll/tap" bug.
  // Deferring children until the first onDidFinishLoadingMap fixes that; once
  // true it stays true (a later mapType style-switch shouldn't re-hide them).
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

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
      styleURL={styleUrlForMapType(mapType, colorScheme)}
      scaleBarEnabled={false}
      attributionPosition={{ bottom: 4, left: 4 }}
      logoPosition={{ bottom: 4, right: 4 }}
      onLayout={onLayout}
      onDidFinishLoadingMap={() => {
        setIsStyleLoaded(true);
        onMapReady?.();
      }}
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
      {isStyleLoaded ? children : null}
    </Mapbox.MapView>
  );
});
