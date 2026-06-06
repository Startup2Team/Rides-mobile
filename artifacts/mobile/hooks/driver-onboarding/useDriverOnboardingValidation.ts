import type { DocFaces, DocumentKey, DriverOnboardingForm } from './onboardingTypes';

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
      if ((form.vehicleType === 'cab' || form.vehicleType === 'hilux') && (!form.passengerSeats || parseInt(form.passengerSeats) < 1)) errors.passengerSeats = 'Enter number of passenger seats';
      if (form.vehicleType === 'fuso' && (!form.loadCapacityKg || parseInt(form.loadCapacityKg) < 1)) errors.loadCapacityKg = 'Enter load capacity in kg';
    }
    if (step === 2) {
      if (!docs.license[0]) errors.license = "Driver's licence front face is required";
      if (!docs.insurance[0]) errors.insurance = 'Insurance document is required';
      if (!docs.authorization[0]) errors.authorization = 'Authorization certificate is required';
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
