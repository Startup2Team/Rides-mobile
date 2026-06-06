import React from 'react';
import { Marker, Polyline } from 'react-native-maps';
import {
  getLocationMapPinCenterOffset,
  LOCATION_MAP_PIN_ANCHOR,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import type { Coords } from '@/types';
import type { AppMapType } from './homeUtils';

export function RoutePreview({
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
  return (
    <>
      {coordinates.length > 1 && (
        <Polyline
          coordinates={coordinates}
          strokeColor={color}
          strokeWidth={4}
          lineCap="butt"
          lineJoin="round"
        />
      )}
      {showPickup && (
        <Marker
          coordinate={pickup}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={getLocationMapPinCenterOffset()}
          tracksViewChanges={false}
        >
          <LocationMapPin variant="pickup" mapType={mapType} />
        </Marker>
      )}
      {showDestination && destination && (
        <Marker
          coordinate={destination}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={getLocationMapPinCenterOffset()}
          tracksViewChanges={false}
        >
          <LocationMapPin variant="destination" mapType={mapType} />
        </Marker>
      )}
    </>
  );
}
