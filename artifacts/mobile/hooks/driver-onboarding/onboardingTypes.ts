import type { VehicleType } from '@/types';

export type DocumentKey = 'license' | 'nationalId' | 'insurance' | 'authorization';
export type DocFaces = [string | null, string | null];
export type CascadeField = 'province' | 'district' | 'sector' | 'cell' | 'village';

export interface DriverOnboardingForm {
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  nationalId: string;
  licenseExpiryDate: string;
  insuranceExpiryDate: string;
  authorizationExpiryDate: string;
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
  nationalId: '',
  licenseExpiryDate: '',
  insuranceExpiryDate: '',
  authorizationExpiryDate: '',
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
  nationalId: [null, null],
  insurance: [null, null],
  authorization: [null, null],
};

export interface DriverOnboardingDraft {
  form: DriverOnboardingForm;
  docs: Record<DocumentKey, DocFaces>;
  selfieUri: string | null;
  acceptedTerms: boolean;
  step: number;
  updatedAt: string;
}
