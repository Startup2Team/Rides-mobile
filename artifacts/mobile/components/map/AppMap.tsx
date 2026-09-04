import React, { forwardRef } from 'react';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import { AppMapGoogle } from './AppMap.google';
import type { AppMapHandle, AppMapProps } from './types';

let AppMapMapboxComponent: React.ComponentType<any> | null = null;
if (MAP_PROVIDER === 'mapbox') {
  try {
    // Only import Mapbox when MAP_PROVIDER === 'mapbox' so static module evaluation
    // does not throw in Expo Go or non-Mapbox builds.
    AppMapMapboxComponent = require('./AppMap.mapbox').AppMapMapbox;
  } catch (e) {
    console.warn('[AppMap] Mapbox native module unavailable, falling back to Google Maps.');
  }
}

/**
 * The ONE map component every screen should render — never import
 * `@rnmapbox/maps` or `react-native-maps` directly outside this directory.
 *
 * Which native SDK actually renders is a single build-time switch:
 * `EXPO_PUBLIC_MAP_PROVIDER=mapbox|google` (constants/mapProvider.ts).
 * See components/map/README.md for the full switch-back procedure.
 */
export const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap(props, ref) {
  if (MAP_PROVIDER === 'mapbox' && AppMapMapboxComponent) {
    const MapboxComp = AppMapMapboxComponent;
    return <MapboxComp ref={ref} {...props} />;
  }
  return <AppMapGoogle ref={ref} {...props} />;
});
