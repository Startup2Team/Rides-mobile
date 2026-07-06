import type { VehicleType } from '@/types';

/** Customer home panel + booking vehicle chips (left-to-right order). */
export const CUSTOMER_VEHICLE_TYPES: VehicleType[] = ['moto', 'rifani', 'cab', 'hilux', 'fuso'];

/**
 * Backend transport_type codes (the API uses SCREAMING_SNAKE identifiers).
 * The mobile uses short local names; every request/response crosses this map.
 */
export type BackendTransportType = 'MOTO_BIKE' | 'CAB_TAXI' | 'HEAVY_FUSO' | 'LIGHT_HILUX' | 'TUK_TUK';

export const VEHICLE_BACKEND_CODE: Record<VehicleType, BackendTransportType> = {
  moto: 'MOTO_BIKE',
  rifani: 'TUK_TUK',
  cab: 'CAB_TAXI',
  hilux: 'LIGHT_HILUX',
  fuso: 'HEAVY_FUSO',
};

const BACKEND_CODE_TO_VEHICLE: Record<BackendTransportType, VehicleType> = {
  MOTO_BIKE: 'moto',
  TUK_TUK: 'rifani',
  CAB_TAXI: 'cab',
  LIGHT_HILUX: 'hilux',
  HEAVY_FUSO: 'fuso',
};

export function toBackendTransportType(vehicle: VehicleType): BackendTransportType {
  return VEHICLE_BACKEND_CODE[vehicle];
}

export function fromBackendTransportType(code: string): VehicleType | null {
  return BACKEND_CODE_TO_VEHICLE[code as BackendTransportType] ?? null;
}

/** Chip / selector — side-view vehicle artwork. */
export const VEHICLE_MARKER_IMAGES: Record<VehicleType, number> = {
  moto: require('../assets/vehicle-markers/moto.png'),
  rifani: require('../assets/vehicle-markers/rifani.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

/** Live map driver markers (moto uses dedicated map artwork). */
export const VEHICLE_MAP_MARKER_IMAGES: Record<VehicleType, number> = {
  moto: require('../assets/vehicle-markers/moto-map.png'),
  rifani: require('../assets/vehicle-markers/rifani.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

/** Chip / selector thumbnail sizes (width × height). */
export const VEHICLE_CHIP_IMAGE_SIZE: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 32, height: 24 },
  rifani: { width: 32, height: 24 },
  cab: { width: 30, height: 22 },
  hilux: { width: 34, height: 22 },
  fuso: { width: 36, height: 24 },
};

/** Larger markers on the live map. */
export const VEHICLE_MAP_IMAGE_SIZE: Record<VehicleType, { width: number; height: number }> = {
  /** Moto PNG is tightly cropped (~99% fill); smaller box matches cab/hilux visual scale. */
  moto: { width: 40, height: 30 },
  rifani: { width: 40, height: 30 },
  cab: { width: 54, height: 40 },
  hilux: { width: 64, height: 40 },
  fuso: { width: 66, height: 44 },
};

/** Searching screen vehicle pulse artwork. */
export const VEHICLE_SEARCHING_IMAGE_SIZE: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 66, height: 50 },
  rifani: { width: 66, height: 50 },
  cab: { width: 62, height: 46 },
  hilux: { width: 70, height: 46 },
  fuso: { width: 72, height: 48 },
};
