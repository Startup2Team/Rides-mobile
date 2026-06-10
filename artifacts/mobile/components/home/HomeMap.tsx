import React, { memo, type RefObject } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import type { Coords, VehicleType } from '@/types';
import { DriverMarkers } from './DriverMarkers';
import { darkMapStyle, styles } from './homeStyles';
import type { AppMapType } from './homeUtils';
import { RoutePreview } from './RoutePreview';

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
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
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
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      onMapReady={onMapReady}
      showsUserLocation={false}
      showsMyLocationButton={false}
      followsUserLocation={false}
      userLocationAnnotationTitle=""
      mapType={mapType}
      customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
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
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
          <View style={styles.youAreHereContainer}>
            <View style={[styles.youAreHereBubble, { backgroundColor: primaryColor }]}>
              <Text style={styles.youAreHereText}>You're Here</Text>
            </View>
            <View style={[styles.youAreHereTail, { borderTopColor: primaryColor }]} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

export const HomeMap = memo(HomeMapComponent);
