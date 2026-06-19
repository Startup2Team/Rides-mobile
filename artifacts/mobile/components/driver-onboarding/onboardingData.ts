import type { VehicleType } from '@/types';

export const ONBOARDING_STEPS = ['Personal', 'Vehicle', 'Documents', 'Payment', 'Review'];

export const DOCUMENTS = [
  { key: 'license', label: "Driver's Licence", hint: 'Capture front and back photos' },
  { key: 'nationalId', label: 'National ID', hint: 'Capture front and back photos' },
  { key: 'insurance', label: 'Vehicle Insurance document', hint: 'Capture the front photo' },
  { key: 'authorization', label: 'Authorization Certificate', hint: 'Capture the front photo' },
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
