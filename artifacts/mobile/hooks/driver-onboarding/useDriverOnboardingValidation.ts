import type { DocFaces, DocumentKey, DriverOnboardingForm, VehiclePhotoKey } from './onboardingTypes';
import { getRequiredVehiclePhotoKeys } from './onboardingTypes';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';
import { isAtLeastAge } from '@/utils/dateUtils';
import { isValidDocumentImageUri } from '@/utils/documentValidation';
import {
  isValidRwandaPlateNumber,
  normalizeRwandaPhoneNumber,
} from '@/utils/rwandaValidation';
import { isValidNationalId } from '@/utils/nationalId';
import { DOCUMENTS_REQUIRING_BACK } from '@/domain/driverDocuments';

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
  vehiclePhotos,
  selfieUri,
  step,
}: {
  acceptedTerms: boolean;
  docs: Record<DocumentKey, DocFaces>;
  form: DriverOnboardingForm;
  vehiclePhotos: Record<VehiclePhotoKey, string | null>;
  selfieUri: string | null;
  step: number;
}) {
  return () => {
    const errors: Record<string, string> = {};
    if (step === 0) {
      if (!selfieUri) errors.selfie = 'Identity photo is required';
      if (!form.dob) errors.dob = 'Required';
      else if (!isAtLeastAge(form.dob, 18)) errors.dob = 'Driver applicants must be at least 18 years old';
      if (!form.nationalIdCountry) errors.nationalIdCountry = 'Select the country that issued this ID';
      if (!form.nationalId) errors.nationalId = 'Required';
      else if (form.nationalIdCountry && !isValidNationalId(form.nationalIdCountry, form.nationalId)) {
        errors.nationalId = form.nationalIdCountry === 'UG'
          ? 'National ID must be exactly 14 letters/digits'
          : 'National ID must be exactly 16 digits';
      }
      if (!form.province) errors.province = 'Required';
      if (!form.district) errors.district = 'Required';
      if (!form.sector) errors.sector = 'Required';
      if (!form.cell) errors.cell = 'Required';
      if (!form.village) errors.village = 'Required';
    }
    if (step === 1) {
      if (!form.brand.trim()) errors.brand = 'Required';
      if (!form.model.trim()) errors.model = 'Required';
      if (!form.manufactureYear.trim()) errors.manufactureYear = 'Required';
      else {
        const year = Number.parseInt(form.manufactureYear, 10);
        const currentYear = new Date().getFullYear();
        if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
          errors.manufactureYear = 'Enter a valid manufacture year';
        }
      }
      if (!form.plateNumber) errors.plateNumber = 'Required';
      else if (!isValidRwandaPlateNumber(form.plateNumber)) errors.plateNumber = 'Enter a valid Rwanda plate in the format RAD 000 A';
      if (!form.licenseNumber) errors.licenseNumber = 'Required';
      else if (!isValidDriverLicenceNumber(form.licenseNumber)) errors.licenseNumber = 'Driver licence number must be exactly 16 digits';
      if ((form.vehicleType === 'cab' || form.vehicleType === 'hilux') && (!form.passengerSeats || parseInt(form.passengerSeats) < 1)) errors.passengerSeats = 'Enter number of passenger seats';
      if (form.vehicleType === 'fuso' && (!form.loadCapacityKg || parseInt(form.loadCapacityKg) < 1)) errors.loadCapacityKg = 'Enter load capacity in kg';
    }
    if (step === 2) {
      validateRequiredImages(errors, 'license', docs.license, "Driver's licence", DOCUMENTS_REQUIRING_BACK.includes('license'));
      validateRequiredImages(errors, 'nationalId', docs.nationalId, 'National ID', DOCUMENTS_REQUIRING_BACK.includes('nationalId'));
      validateRequiredImages(errors, 'insurance', docs.insurance, 'Insurance document', DOCUMENTS_REQUIRING_BACK.includes('insurance'));
      validateRequiredImages(errors, 'authorization', docs.authorization, 'Authorization certificate', DOCUMENTS_REQUIRING_BACK.includes('authorization'));
      getRequiredVehiclePhotoKeys(form.vehicleType).forEach(key => {
        const label = key === 'outside' ? 'Vehicle outside photo' : 'Vehicle inside photo';
        if (!vehiclePhotos[key]) errors[`vehicle${key === 'outside' ? 'Outside' : 'Inside'}Photo`] = `${label} is required`;
        else if (!isValidDocumentImageUri(vehiclePhotos[key])) errors[`vehicle${key === 'outside' ? 'Outside' : 'Inside'}Photo`] = `${label} must be a valid image`;
      });
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
