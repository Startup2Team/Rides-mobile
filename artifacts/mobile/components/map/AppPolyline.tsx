import Mapbox from '@rnmapbox/maps';
import React, { useMemo } from 'react';
import { Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '@/constants/mapProvider';
import { APPLE_SYSTEM_RED_HEX } from '@/constants/systemColors';
import type { AppPolylineProps } from './types';

let shapeSourceCounter = 0;

/** Road-following polyline, e.g. from useRoute()/route.coordinates. */
export function AppPolyline({
  coordinates,
  color = APPLE_SYSTEM_RED_HEX.light,
  width = 4,
  lineCap = 'butt',
  lineJoin = 'round',
}: AppPolylineProps) {
  // Stable per-mounted-instance id — ShapeSource ids must be unique within a
  // style, and this component can be mounted many times per screen (route
  // preview + remaining-route + full-route, one active at a time).
  const sourceId = useMemo(() => `app-polyline-${(shapeSourceCounter += 1)}`, []);

  if (coordinates.length < 2) return null;

  if (MAP_PROVIDER === 'google') {
    return (
      <Polyline
        coordinates={coordinates}
        strokeColor={color}
        strokeWidth={width}
        lineCap={lineCap}
        lineJoin={lineJoin}
      />
    );
  }

  const shape: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map(c => [c.longitude, c.latitude]),
    },
  };

  return (
    <Mapbox.ShapeSource id={sourceId} shape={shape}>
      <Mapbox.LineLayer
        id={`${sourceId}-line`}
        style={{
          lineColor: color,
          lineWidth: width,
          lineCap,
          lineJoin,
        }}
      />
    </Mapbox.ShapeSource>
  );
}
