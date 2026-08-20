import type { DriverProfile } from '@/types';
import type { DriverOnboardingForm } from './onboardingTypes';
import { normalizeRwandaPhoneNumber, normalizeRwandaPlateNumber } from '@/utils/rwandaValidation';

export function buildPendingDriverProfile(form: DriverOnboardingForm, selfieUri: string | null): DriverProfile {
  return {
    verificationStatus: 'pending_review',
    vehicleType: form.vehicleType,
    brand: form.brand.trim() || undefined,
    model: form.model.trim() || undefined,
    manufactureYear: form.manufactureYear ? Number.parseInt(form.manufactureYear, 10) : undefined,
    plateNumber: normalizeRwandaPlateNumber(form.plateNumber),
    licenseNumber: form.licenseNumber,
    nationalId: form.nationalId,
    nationalIdCountry: form.nationalIdCountry || undefined,
    gender: form.gender || undefined,
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
    brand: profile.brand ?? '',
    model: profile.model ?? '',
    manufactureYear: profile.manufactureYear?.toString() ?? '',
    plateNumber: profile.plateNumber,
    licenseNumber: profile.licenseNumber,
    nationalId: profile.nationalId ?? '',
    nationalIdCountry: profile.nationalIdCountry ?? '',
    licenseExpiryDate: profile.licenseExpiryDate ?? '',
    insuranceExpiryDate: profile.insuranceExpiryDate ?? '',
    authorizationExpiryDate: profile.authorizationExpiryDate ?? '',
    dob: profile.dob,
    province: profile.province,
    district: profile.district,
    sector: profile.sector,
    cell: profile.cell ?? '',
    village: profile.village ?? '',
    // Was hardcoded to '' — every resume/resubmit silently dropped the
    // driver's previously-chosen gender even though it was saved on the
    // profile. Read it back like every other optional field here.
    gender: profile.gender ?? '',
    momoProvider: profile.momoProvider,
    momoCode: profile.momoCode,
    merchantCode: profile.merchantCode ?? '',
    passengerSeats: profile.passengerSeats?.toString() ?? '',
    loadCapacityKg: profile.loadCapacityKg?.toString() ?? '',
  };
}
