import type { VehicleType } from '@/types';

/** Chip / selector — side-view vehicle artwork. */
export const VEHICLE_MARKER_IMAGES: Record<VehicleType, number> = {
  moto: require('../assets/vehicle-markers/moto.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

/** Live map driver markers (moto uses dedicated map artwork). */
export const VEHICLE_MAP_MARKER_IMAGES: Record<VehicleType, number> = {
  moto: require('../assets/vehicle-markers/moto-map.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

/** Chip / selector thumbnail sizes (width × height). */
export const VEHICLE_CHIP_IMAGE_SIZE: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 32, height: 24 },
  cab: { width: 30, height: 22 },
  hilux: { width: 34, height: 22 },
  fuso: { width: 36, height: 24 },
};

/** Larger markers on the live map. */
export const VEHICLE_MAP_IMAGE_SIZE: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 58, height: 46 },
  cab: { width: 54, height: 40 },
  hilux: { width: 64, height: 40 },
  fuso: { width: 66, height: 44 },
};
