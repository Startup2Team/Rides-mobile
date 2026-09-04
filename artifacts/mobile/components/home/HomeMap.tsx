import React, { memo, type RefObject } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { AppMap, AppMarker, type AppMapHandle, type AppMapRegion, type AppMapType } from '@/components/map';
import type { Coords, VehicleType } from '@/types';
import { DriverMarkers } from './DriverMarkers';
import { styles } from './homeStyles';
import { RoutePreview } from './RoutePreview';
import { AppText } from '@/components/AppText';

function HomeMapComponent({
  mapRef,
  initialRegion,
  mapType,
  onMapReady,
  routeCoordinates,
  routeColor,
  pickup,
  destination,
  showPickup,
  showDestination,
  drivers,
  selectedVehicle,
  showYouAreHere,
  userLocation,
  primaryColor,
}: {
  mapRef: RefObject<AppMapHandle | null>;
  initialRegion: AppMapRegion;
  mapType: AppMapType;
  onMapReady: () => void;
  routeCoordinates: Coords[];
  routeColor: string;
  pickup: Coords;
  destination: Coords | null;
  showPickup: boolean;
  showDestination: boolean;
  drivers: { id: string; latitude: number; longitude: number }[];
  selectedVehicle: VehicleType;
  showYouAreHere: boolean;
  userLocation: Coords | null;
  primaryColor: ColorValue;
}) {
  return (
    <AppMap
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onMapReady={onMapReady}
      mapType={mapType}
    >
      <RoutePreview
        coordinates={routeCoordinates}
        color={routeColor}
        pickup={pickup}
        destination={destination}
        showPickup={showPickup}
        showDestination={showDestination}
        mapType={mapType}
      />
      <DriverMarkers drivers={drivers} vehicleType={selectedVehicle} />
      {showYouAreHere && userLocation && (
        <AppMarker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
          <View style={styles.youAreHereContainer}>
            <View style={[styles.youAreHereBubble, { backgroundColor: primaryColor }]}>
              <AppText variant="caption" style={styles.youAreHereText}>You're Here</AppText>
            </View>
            <View style={[styles.youAreHereTail, { borderTopColor: primaryColor }]} />
          </View>
        </AppMarker>
      )}
    </AppMap>
  );
}

export const HomeMap = memo(HomeMapComponent);
