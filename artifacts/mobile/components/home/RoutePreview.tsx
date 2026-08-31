import React, { memo, useEffect, useMemo, useState } from 'react';
import { AppMarker, AppPolyline } from '@/components/map';
import {
  getLocationMapPinCenterOffset,
  LOCATION_MAP_PIN_ANCHOR,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import type { Coords } from '@/types';
import type { AppMapType } from './homeUtils';
import { ROUTE_DRAW_INTERVAL_MS, ROUTE_DRAW_STEP, sliceRouteByProgress } from './homeUtils';

function RoutePreviewComponent({
  coordinates,
  color,
  pickup,
  destination,
  showPickup,
  showDestination,
  mapType,
}: {
  coordinates: Coords[];
  color: string;
  pickup: Coords;
  destination: Coords | null;
  showPickup: boolean;
  showDestination: boolean;
  mapType: AppMapType;
}) {
  const [progress, setProgress] = useState(0);
  const animatedCoordinates = useMemo(
    () => coordinates.length < 2
      ? []
      : sliceRouteByProgress(coordinates, 0, Math.min(progress, 1)),
    [coordinates, progress],
  );

  useEffect(() => {
    if (coordinates.length < 2) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(previous => {
        if (previous >= 1) {
          clearInterval(interval);
          return 1;
        }
        return Math.min(previous + ROUTE_DRAW_STEP, 1);
      });
    }, ROUTE_DRAW_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [coordinates]);

  return (
    <>
      {animatedCoordinates.length > 1 && (
        <AppPolyline
          coordinates={animatedCoordinates}
          color={color}
          width={4}
          lineCap="butt"
          lineJoin="round"
        />
      )}
      {showPickup && (
        <AppMarker
          identifier="booking-pickup"
          coordinate={pickup}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={getLocationMapPinCenterOffset()}
          tracksViewChanges
          zIndex={3}
        >
          <LocationMapPin variant="pickup" mapType={mapType} />
        </AppMarker>
      )}
      {showDestination && destination && (
        <AppMarker
          identifier="booking-destination"
          coordinate={destination}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={getLocationMapPinCenterOffset()}
          tracksViewChanges
          zIndex={4}
        >
          <LocationMapPin variant="destination" mapType={mapType} />
        </AppMarker>
      )}
    </>
  );
}

export const RoutePreview = memo(RoutePreviewComponent);
