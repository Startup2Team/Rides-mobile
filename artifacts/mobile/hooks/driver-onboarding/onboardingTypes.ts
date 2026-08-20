import type { VehicleType } from '@/types';

export type DocumentKey = 'license' | 'nationalId' | 'insurance' | 'authorization';
export type DocFaces = [string | null, string | null];
export type CascadeField = 'province' | 'district' | 'sector' | 'cell' | 'village';
export type VehiclePhotoKey = 'outside' | 'inside';

export interface DriverOnboardingForm {
  vehicleType: VehicleType;
  brand: string;
  model: string;
  manufactureYear: string;
  plateNumber: string;
  licenseNumber: string;
  nationalId: string;
  nationalIdCountry: 'RW' | 'UG' | '';
  licenseExpiryDate: string;
  insuranceExpiryDate: string;
  authorizationExpiryDate: string;
  dob: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  gender: 'male' | 'female' | 'other' | '';
  momoProvider: 'mtn' | 'airtel';
  momoCode: string;
  merchantCode: string;
  passengerSeats: string;
  loadCapacityKg: string;
}

export const INITIAL_DRIVER_ONBOARDING_FORM: DriverOnboardingForm = {
  vehicleType: 'moto',
  brand: '',
  model: '',
  manufactureYear: '',
  plateNumber: '',
  licenseNumber: '',
  nationalId: '',
  nationalIdCountry: '',
  licenseExpiryDate: '',
  insuranceExpiryDate: '',
  authorizationExpiryDate: '',
  dob: '',
  province: '',
  district: '',
  sector: '',
  cell: '',
  village: '',
  gender: '',
  momoProvider: 'mtn',
  momoCode: '',
  merchantCode: '',
  passengerSeats: '',
  loadCapacityKg: '',
};

export const INITIAL_DRIVER_DOCUMENTS: Record<DocumentKey, DocFaces> = {
  license: [null, null],
  nationalId: [null, null],
  insurance: [null, null],
  authorization: [null, null],
};

export function getRequiredVehiclePhotoKeys(vehicleType: VehicleType): VehiclePhotoKey[] {
  switch (vehicleType) {
    case 'cab':
      return ['outside', 'inside'];
    case 'hilux':
    case 'fuso':
      return ['outside'];
    case 'moto':
    case 'rifani':
    default:
      return [];
  }
}

export interface DriverOnboardingDraft {
  form: DriverOnboardingForm;
  docs: Record<DocumentKey, DocFaces>;
  vehiclePhotos: Record<VehiclePhotoKey, string | null>;
  selfieUri: string | null;
  acceptedTerms: boolean;
  step: number;
  updatedAt: string;
}

export function requiresVehiclePhotos(vehicleType: VehicleType) {
  return getRequiredVehiclePhotoKeys(vehicleType).length > 0;
}

export function getVehicleBrandModelPlaceholders(vehicleType: VehicleType) {
  switch (vehicleType) {
    case 'moto':
      return { brand: 'Yamaha', model: 'BWS' };
    case 'rifani':
      return { brand: 'Bajaj', model: 'Boxer' };
    case 'hilux':
      return { brand: 'Toyota', model: 'Hilux' };
    case 'fuso':
      return { brand: 'Mitsubishi', model: 'Canter' };
    case 'cab':
    default:
      return { brand: 'Toyota', model: 'Corolla' };
  }
}
