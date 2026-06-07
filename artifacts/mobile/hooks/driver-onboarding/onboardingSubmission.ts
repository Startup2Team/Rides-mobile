import type { DriverProfile } from '@/types';
import type { DriverOnboardingForm } from './onboardingTypes';
import { normalizeRwandaPhoneNumber, normalizeRwandaPlateNumber } from '@/utils/rwandaValidation';

export function buildPendingDriverProfile(form: DriverOnboardingForm, selfieUri: string | null): DriverProfile {
  return {
    verificationStatus: 'pending_review',
    vehicleType: form.vehicleType,
    plateNumber: normalizeRwandaPlateNumber(form.plateNumber),
    licenseNumber: form.licenseNumber,
    nationalId: form.nationalId,
    licenseExpiryDate: form.licenseExpiryDate,
    insuranceExpiryDate: form.insuranceExpiryDate,
    authorizationExpiryDate: form.authorizationExpiryDate,
    province: form.province,
    district: form.district,
    sector: form.sector,
    cell: form.cell,
    village: form.village,
    momoCode: normalizeRwandaPhoneNumber(form.momoCode) ?? '',
    merchantCode: form.merchantCode.trim().toUpperCase(),
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

export function buildDraftDriverProfile(form: DriverOnboardingForm, selfieUri: string | null): DriverProfile {
  return {
    ...buildPendingDriverProfile(form, selfieUri),
    verificationStatus: 'draft',
    policyAccepted: false,
    policyAcceptedAt: undefined,
  };
}

export function formFromDriverProfile(profile: DriverProfile): DriverOnboardingForm {
  return {
    vehicleType: profile.vehicleType,
    plateNumber: profile.plateNumber,
    licenseNumber: profile.licenseNumber,
    nationalId: profile.nationalId ?? '',
    licenseExpiryDate: profile.licenseExpiryDate ?? '',
    insuranceExpiryDate: profile.insuranceExpiryDate ?? '',
    authorizationExpiryDate: profile.authorizationExpiryDate ?? '',
    dob: profile.dob,
    province: profile.province,
    district: profile.district,
    sector: profile.sector,
    cell: profile.cell ?? '',
    village: profile.village ?? '',
    momoProvider: profile.momoProvider,
    momoCode: profile.momoCode,
    merchantCode: profile.merchantCode ?? '',
    passengerSeats: profile.passengerSeats?.toString() ?? '',
    loadCapacityKg: profile.loadCapacityKg?.toString() ?? '',
  };
}
