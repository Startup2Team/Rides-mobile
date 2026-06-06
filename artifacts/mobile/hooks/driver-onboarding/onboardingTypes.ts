import type { VehicleType } from '@/types';

export type DocumentKey = 'license' | 'insurance' | 'authorization';
export type DocFaces = [string | null, string | null];
export type CascadeField = 'province' | 'district' | 'sector' | 'cell' | 'village';

export interface DriverOnboardingForm {
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  dob: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  momoProvider: 'mtn' | 'airtel';
  momoCode: string;
  merchantCode: string;
  passengerSeats: string;
  loadCapacityKg: string;
}

export const INITIAL_DRIVER_ONBOARDING_FORM: DriverOnboardingForm = {
  vehicleType: 'moto',
  plateNumber: '',
  licenseNumber: '',
  dob: '',
  province: '',
  district: '',
  sector: '',
  cell: '',
  village: '',
  momoProvider: 'mtn',
  momoCode: '',
  merchantCode: '',
  passengerSeats: '',
  loadCapacityKg: '',
};

export const INITIAL_DRIVER_DOCUMENTS: Record<DocumentKey, DocFaces> = {
  license: [null, null],
  insurance: [null, null],
  authorization: [null, null],
};
