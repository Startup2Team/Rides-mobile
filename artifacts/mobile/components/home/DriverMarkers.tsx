import React from 'react';
import { Marker } from 'react-native-maps';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import type { VehicleType } from '@/types';

interface DriverMarker {
  id: string;
  latitude: number;
  longitude: number;
}

export function DriverMarkers({
  drivers,
  vehicleType,
}: {
  drivers: DriverMarker[];
  vehicleType: VehicleType;
}) {
  return drivers.map(driver => (
    <Marker
      key={driver.id}
      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={1}
    >
      <VehicleMapMarker type={vehicleType} />
    </Marker>
  ));
}
