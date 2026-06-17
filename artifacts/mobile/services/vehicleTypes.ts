export const VEHICLE_TYPES = {
  MOTO_BIKE: { code: 'MOTO_BIKE', label: 'Ordinary Moto', seats: 1, icon: '🏍️' },
  CAB_TAXI: { code: 'CAB_TAXI', label: 'Ordinary Cab', seats: 4, icon: '🚕' },
  LIGHT_HILUX: { code: 'LIGHT_HILUX', label: 'Hilux (Light)', seats: 5, icon: '🚙' },
  HEAVY_FUSO: { code: 'HEAVY_FUSO', label: 'Fuso (Heavy)', seats: 2, icon: '🚛' },
  TUK_TUK: { code: 'TUK_TUK', label: 'Tuk Tuk', seats: 3, icon: '🛺' },
} as const;

export type VehicleTypeCode = keyof typeof VEHICLE_TYPES;

export const VEHICLE_TYPE_CODES: VehicleTypeCode[] = Object.keys(VEHICLE_TYPES) as VehicleTypeCode[];

export type LegacyVehicleType = 'moto' | 'cab' | 'hilux' | 'fuso';

export const LEGACY_TO_API_VEHICLE: Record<LegacyVehicleType, VehicleTypeCode> = {
  moto: 'MOTO_BIKE',
  cab: 'CAB_TAXI',
  hilux: 'LIGHT_HILUX',
  fuso: 'HEAVY_FUSO',
};

export const API_TO_LEGACY_VEHICLE: Record<VehicleTypeCode, LegacyVehicleType> = {
  MOTO_BIKE: 'moto',
  CAB_TAXI: 'cab',
  LIGHT_HILUX: 'hilux',
  HEAVY_FUSO: 'fuso',
  TUK_TUK: 'moto',
};
