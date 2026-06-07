import type { DriverProfile } from '@/types';
import type { DriverOnboardingForm } from './onboardingTypes';

export function buildPendingDriverProfile(form: DriverOnboardingForm, selfieUri: string | null): DriverProfile {
  return {
    verificationStatus: 'pending_review',
    vehicleType: form.vehicleType,
    plateNumber: form.plateNumber,
    licenseNumber: form.licenseNumber,
    licenseExpiryDate: form.licenseExpiryDate,
    insuranceExpiryDate: form.insuranceExpiryDate,
    authorizationExpiryDate: form.authorizationExpiryDate,
    province: form.province,
    district: form.district,
    sector: form.sector,
    cell: form.cell,
    village: form.village,
    momoCode: form.momoCode,
    merchantCode: form.merchantCode,
    momoProvider: form.momoProvider,
    dob: form.dob,
    profileImage: selfieUri ?? undefined,
    isOnline: false,
    isVerified: false,
    acceptanceRate: 100,
    completedRides: 0,
    dailyRides: 0,
    dailyDeclines: 0,
    policyAccepted: true,
    policyAcceptedAt: new Date().toISOString(),
    earningsTotal: 0,
    passengerSeats: form.passengerSeats ? parseInt(form.passengerSeats) : undefined,
    loadCapacityKg: form.loadCapacityKg ? parseInt(form.loadCapacityKg) : undefined,
  };
}
