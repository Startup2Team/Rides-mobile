import React, { useMemo } from 'react';
import { Circle } from 'react-native-maps';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import { circlePolygon } from './geo';
import type { AppCircleProps } from './types';

let Mapbox: typeof import('@rnmapbox/maps').default | null = null;
if (MAP_PROVIDER === 'mapbox') {
  try {
    Mapbox = require('@rnmapbox/maps').default;
  } catch (e) {
    console.warn('[AppCircle] Mapbox native module unavailable');
  }
}

let shapeSourceCounter = 0;

/** A real-world-meters circle (e.g. demand heatmap cells) — radius scales
 * with zoom like a geographic shape, not a fixed screen size. */
export function AppCircle({
  center,
  radius,
  strokeWidth = 0,
  strokeColor = 'transparent',
  fillColor = 'rgba(255,59,48,0.3)',
}: AppCircleProps) {
  const sourceId = useMemo(() => `app-circle-${(shapeSourceCounter += 1)}`, []);

  if (MAP_PROVIDER === 'google' || !Mapbox) {
    return (
      <Circle
        center={center}
        radius={radius}
        strokeWidth={strokeWidth}
        strokeColor={strokeColor}
        fillColor={fillColor}
      />
    );
  }

  const polygon = circlePolygon(center, radius);
  const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [polygon],
    },
  };

  return (
    <Mapbox.ShapeSource id={sourceId} shape={geojson}>
      <Mapbox.FillLayer
        id={`${sourceId}-fill`}
        style={{
          fillColor,
          fillOutlineColor: strokeColor === 'transparent' ? undefined : strokeColor,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
