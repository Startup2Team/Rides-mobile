import React, { memo, useMemo } from 'react';
import { AppMarker } from '@/components/map';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import type { VehicleType } from '@/types';

interface DriverMarker {
  id: string;
  latitude: number;
  longitude: number;
}

const DriverMarkerItem = memo(function DriverMarkerItem({
  driver,
  vehicleType,
}: {
  driver: DriverMarker;
  vehicleType: VehicleType;
}) {
  const coordinate = useMemo(
    () => ({ latitude: driver.latitude, longitude: driver.longitude }),
    [driver.latitude, driver.longitude],
  );

  return (
    <AppMarker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={1}
    >
      <VehicleMapMarker type={vehicleType} />
    </AppMarker>
  );
});

function DriverMarkersComponent({
  drivers,
  vehicleType,
}: {
  drivers: DriverMarker[];
  vehicleType: VehicleType;
}) {
  return drivers.map(driver => (
    <DriverMarkerItem key={driver.id} driver={driver} vehicleType={vehicleType} />
  ));
}

export const DriverMarkers = memo(DriverMarkersComponent);
