import React, { forwardRef } from 'react';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import { AppMapGoogle } from './AppMap.google';
import { AppMapMapbox } from './AppMap.mapbox';
import type { AppMapHandle, AppMapProps } from './types';

/**
 * The ONE map component every screen should render — never import
 * `@rnmapbox/maps` or `react-native-maps` directly outside this directory.
 *
 * Which native SDK actually renders is a single build-time switch:
 * `EXPO_PUBLIC_MAP_PROVIDER=mapbox|google` (constants/mapProvider.ts).
 * See components/map/README.md for the full switch-back procedure.
 */
export const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap(props, ref) {
  return MAP_PROVIDER === 'google'
    ? <AppMapGoogle ref={ref} {...props} />
    : <AppMapMapbox ref={ref} {...props} />;
});
