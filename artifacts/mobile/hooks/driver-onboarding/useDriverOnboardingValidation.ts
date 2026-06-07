import type { DocFaces, DocumentKey, DriverOnboardingForm } from './onboardingTypes';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';
import { isValidDocumentImageUri } from '@/utils/documentValidation';
import {
  isValidRwandaNationalId,
  isValidRwandaPlateNumber,
  normalizeRwandaPhoneNumber,
} from '@/utils/rwandaValidation';

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
      if (!form.nationalId) errors.nationalId = 'Required';
      else if (!isValidRwandaNationalId(form.nationalId)) errors.nationalId = 'National ID must be exactly 16 digits';
      if (!form.province) errors.province = 'Required';
      if (!form.district) errors.district = 'Required';
      if (!form.sector) errors.sector = 'Required';
      if (!form.cell) errors.cell = 'Required';
      if (!form.village) errors.village = 'Required';
    }
    if (step === 1) {
      if (!form.plateNumber) errors.plateNumber = 'Required';
      else if (!isValidRwandaPlateNumber(form.plateNumber)) errors.plateNumber = 'Enter a valid Rwanda plate in the format RAD 000 A';
      if (!form.licenseNumber) errors.licenseNumber = 'Required';
      else if (!isValidDriverLicenceNumber(form.licenseNumber)) errors.licenseNumber = 'Driver licence number must be exactly 16 digits';
      if ((form.vehicleType === 'cab' || form.vehicleType === 'hilux') && (!form.passengerSeats || parseInt(form.passengerSeats) < 1)) errors.passengerSeats = 'Enter number of passenger seats';
      if (form.vehicleType === 'fuso' && (!form.loadCapacityKg || parseInt(form.loadCapacityKg) < 1)) errors.loadCapacityKg = 'Enter load capacity in kg';
    }
    if (step === 2) {
      validateRequiredImages(errors, 'license', docs.license, "Driver's licence", true);
      validateRequiredImages(errors, 'nationalId', docs.nationalId, 'National ID', true);
      validateRequiredImages(errors, 'insurance', docs.insurance, 'Insurance document', false);
      validateRequiredImages(errors, 'authorization', docs.authorization, 'Authorization certificate', true);
      if (!form.licenseExpiryDate) errors.licenseExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.licenseExpiryDate)) errors.licenseExpiryDate = 'Expiry date must be in the future';
      if (!form.insuranceExpiryDate) errors.insuranceExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.insuranceExpiryDate)) errors.insuranceExpiryDate = 'Expiry date must be in the future';
      if (!form.authorizationExpiryDate) errors.authorizationExpiryDate = 'Required';
      else if (!isFutureExpiryDate(form.authorizationExpiryDate)) errors.authorizationExpiryDate = 'Expiry date must be in the future';
    }
    if (step === 3) {
      const hasMomoCode = form.momoCode.trim().length > 0;
      const hasMerchantCode = form.merchantCode.trim().length > 0;
      if (!hasMomoCode && !hasMerchantCode) errors.momoCode = errors.merchantCode = 'Enter a phone number or merchant code';
      if (hasMomoCode && !normalizeRwandaPhoneNumber(form.momoCode)) errors.momoCode = 'Enter 07XXXXXXXX or +2507XXXXXXXX';
      if (hasMerchantCode && form.merchantCode.trim().length < 3) errors.merchantCode = 'Enter a valid merchant code';
      if (!acceptedTerms) errors.acceptedTerms = 'Required';
    }
    return errors;
  };
}

function validateRequiredImages(
  errors: Record<string, string>,
  key: DocumentKey,
  faces: DocFaces,
  label: string,
  requireBack: boolean,
) {
  if (!faces[0]) {
    errors[key] = `${label} front image is required`;
    return;
  }
  if (!isValidDocumentImageUri(faces[0])) {
    errors[key] = `${label} front must be a valid image`;
    return;
  }
  if (requireBack && !faces[1]) {
    errors[key] = `${label} back image is required`;
    return;
  }
  if (faces[1] && !isValidDocumentImageUri(faces[1])) {
    errors[key] = `${label} back must be a valid image`;
  }
}
