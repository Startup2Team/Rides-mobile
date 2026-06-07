import type { DocFaces, DocumentKey, DriverOnboardingForm } from './onboardingTypes';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';

export const isValidDriverLicenceNumber = (licenceNumber: string) => /^\d{16}$/.test(licenceNumber);
export const isFutureExpiryDate = (value: string, today = new Date()) => {
  const date = parseDateDdMmYyyy(value);
  if (!date) return false;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date > startOfToday;
};

export function useDriverOnboardingValidation({
  acceptedTerms,
  docs,
  form,
  selfieUri,
  step,
}: {
  acceptedTerms: boolean;
  docs: Record<DocumentKey, DocFaces>;
  form: DriverOnboardingForm;
  selfieUri: string | null;
  step: number;
}) {
  return () => {
    const errors: Record<string, string> = {};
    if (step === 0) {
      if (!selfieUri) errors.selfie = 'Identity photo is required';
      if (!form.dob) errors.dob = 'Required';
      if (!form.province) errors.province = 'Required';
      if (!form.district) errors.district = 'Required';
      if (!form.sector) errors.sector = 'Required';
      if (!form.cell) errors.cell = 'Required';
      if (!form.village) errors.village = 'Required';
    }
    if (step === 1) {
      if (!form.plateNumber) errors.plateNumber = 'Required';
      if (!form.licenseNumber) errors.licenseNumber = 'Required';
      else if (!isValidDriverLicenceNumber(form.licenseNumber)) errors.licenseNumber = 'Driver licence number must be exactly 16 digits';
      if ((form.vehicleType === 'cab' || form.vehicleType === 'hilux') && (!form.passengerSeats || parseInt(form.passengerSeats) < 1)) errors.passengerSeats = 'Enter number of passenger seats';
      if (form.vehicleType === 'fuso' && (!form.loadCapacityKg || parseInt(form.loadCapacityKg) < 1)) errors.loadCapacityKg = 'Enter load capacity in kg';
    }
    if (step === 2) {
      if (!docs.license[0]) errors.license = "Driver's licence front face is required";
      if (!docs.insurance[0]) errors.insurance = 'Insurance document is required';
      if (!docs.authorization[0]) errors.authorization = 'Authorization certificate is required';
      if (!form.licenseExpiryDate) errors.licenseExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.licenseExpiryDate)) errors.licenseExpiryDate = 'Expiry date must be in the future';
      if (!form.insuranceExpiryDate) errors.insuranceExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.insuranceExpiryDate)) errors.insuranceExpiryDate = 'Expiry date must be in the future';
      if (!form.authorizationExpiryDate) errors.authorizationExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.authorizationExpiryDate)) errors.authorizationExpiryDate = 'Expiry date must be in the future';
    }
    if (step === 3) {
      const hasMomoCode = form.momoCode.replace(/\D/g, '').length > 0;
      const hasMerchantCode = form.merchantCode.trim().length > 0;
      if (!hasMomoCode && !hasMerchantCode) errors.momoCode = errors.merchantCode = 'Enter a phone number or merchant code';
      if (hasMomoCode && form.momoCode.replace(/\D/g, '').length < 9) errors.momoCode = 'Enter a valid phone number';
      if (hasMerchantCode && form.merchantCode.trim().length < 3) errors.merchantCode = 'Enter a valid merchant code';
      if (!acceptedTerms) errors.acceptedTerms = 'Required';
    }
    return errors;
  };
}
