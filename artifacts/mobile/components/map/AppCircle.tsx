import Mapbox from '@rnmapbox/maps';
import React, { useMemo } from 'react';
import { Circle } from 'react-native-maps';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import { circlePolygon } from './geo';
import type { AppCircleProps } from './types';

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

  if (MAP_PROVIDER === 'google') {
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

  const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [circlePolygon(center, radius)],
    },
  };

  return (
    <Mapbox.ShapeSource id={sourceId} shape={shape}>
      <Mapbox.FillLayer
        id={`${sourceId}-fill`}
        style={{
          fillColor,
          fillOutlineColor: strokeWidth > 0 ? strokeColor : fillColor,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
