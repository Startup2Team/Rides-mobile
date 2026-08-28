import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Coords } from '@/types';

/** Same shape react-native-maps calls a "Region" — kept identical so callers
 * that already think in lat/lng + deltas don't need to change. */
export interface AppMapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface AppEdgePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
export type AppMapType = (typeof MAP_TYPES)[number];

export interface AppMapAnchor {
  x: number;
  y: number;
}

export interface AppMapFitOptions {
  edgePadding: AppEdgePadding;
  animated?: boolean;
}

/** Imperative camera + query handle exposed via ref — same shape on both
 * providers so screens never branch on MAP_PROVIDER. */
export interface AppMapHandle {
  fitToCoordinates: (coordinates: Coords[], options: AppMapFitOptions) => void;
  animateToRegion: (region: AppMapRegion, durationMs?: number) => void;
  /** Geo coordinate under a screen point relative to the map view. */
  coordinateForPoint: (point: { x: number; y: number }) => Promise<Coords>;
}

export interface AppMapProps {
  initialRegion: AppMapRegion;
  mapType?: AppMapType;
  style?: StyleProp<ViewStyle>;
  onMapReady?: () => void;
  onLayout?: (event: { nativeEvent: { layout: { width: number; height: number } } }) => void;
  /** Fired while the user is actively dragging/panning the map. */
  onPanDrag?: () => void;
  /** Fired once a user-driven region change has settled. */
  onRegionChangeComplete?: (region: AppMapRegion) => void;
  children?: ReactNode;
}

export interface AppMarkerProps {
  coordinate: Coords;
  anchor?: AppMapAnchor;
  centerOffset?: { x: number; y: number };
  /** Draw-order hint. Google respects this natively; the Mapbox
   * implementation approximates it via render order (see AppMarker.tsx). */
  zIndex?: number;
  identifier?: string;
  title?: string;
  description?: string;
  accessibilityLabel?: string;
  /** Google-only perf hint (Mapbox markers are always native-measured). */
  tracksViewChanges?: boolean;
  children?: ReactNode;
}

export interface AppPolylineProps {
  coordinates: Coords[];
  color?: string;
  width?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export interface AppCircleProps {
  center: Coords;
  /** Radius in meters — a real-world distance that scales with zoom, same
   * semantics as react-native-maps' Circle. */
  radius: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
}
