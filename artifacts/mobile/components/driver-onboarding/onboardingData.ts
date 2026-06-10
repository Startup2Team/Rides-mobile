import type { VehicleType } from '@/types';

export const ONBOARDING_STEPS = ['Personal Info', 'Vehicle Info', 'Documents', 'Payment'];

export const DOCUMENTS = [
  { key: 'license', label: "Driver's Licence", hint: 'Front and back faces — JPEG or PNG' },
  { key: 'insurance', label: 'Vehicle Insurance document', hint: 'Front face required — JPEG, PNG or PDF' },
  { key: 'authorization', label: 'Vehicle Authorization / Inspection certificate', hint: 'Front face required — JPEG, PNG or PDF' },
] as const;

export const VEHICLE_QUESTIONS: Record<VehicleType, { field: string; label: string; placeholder: string }[]> = {
  moto: [],
  rifani: [],
  cab: [{ field: 'passengerSeats', label: 'How many passenger seats does your vehicle have?', placeholder: 'e.g. 4' }],
  hilux: [{ field: 'passengerSeats', label: 'How many passenger seats does your vehicle have?', placeholder: 'e.g. 5' }],
  fuso: [{ field: 'loadCapacityKg', label: 'Maximum load capacity (kg)', placeholder: 'e.g. 5000' }],
};

export const PAYMENT_PROVIDER_LOGOS = {
  mtn: require('../../assets/payment-providers/mtn.png'),
  airtel: require('../../assets/payment-providers/airtel.png'),
};
