import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { DocumentUploadSection } from '@/components/driver-onboarding/DocumentUploadSection';
import { PersonalInformationSection } from '@/components/driver-onboarding/PersonalInformationSection';
import { ProgressHeader } from '@/components/driver-onboarding/ProgressHeader';
import { RequirementsSection } from '@/components/driver-onboarding/RequirementsSection';
import { VehicleInformationSection } from '@/components/driver-onboarding/VehicleInformationSection';
import { styles } from '@/components/driver-onboarding/onboardingStyles';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useDriverDocumentUpload } from '@/hooks/driver-onboarding/useDriverDocumentUpload';
import { useDriverOnboardingForm } from '@/hooks/driver-onboarding/useDriverOnboardingForm';
import { useDriverOnboardingValidation } from '@/hooks/driver-onboarding/useDriverOnboardingValidation';
import type { DriverProfile } from '@/types';

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, saveDriverProfile, switchMode } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const {
    errors,
    form,
    handlePlateChange,
    maxDobDate,
    plateWarning,
    setErrors,
    update,
    updateCascade,
  } = useDriverOnboardingForm();
  const {
    docs,
    pickDocument,
    selfieUri,
    takeDocumentPhoto,
    takeSelfie,
  } = useDriverDocumentUpload(setErrors);
  const validate = useDriverOnboardingValidation({
    acceptedTerms,
    docs,
    form,
    selfieUri,
    step,
  });

  const saveAndContinue = async () => {
    setLoading(true);
    const profile: DriverProfile = {
      vehicleType: form.vehicleType,
      plateNumber: form.plateNumber,
      licenseNumber: form.licenseNumber,
      province: form.province,
      district: form.district,
      sector: form.sector,
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
    await saveDriverProfile(profile);
    await switchMode('driver');
    setLoading(false);
    router.replace('/(driver)');
  };

  const handleNext = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    if (step < 3) {
      setStep(current => current + 1);
    } else {
      saveAndContinue();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ProgressHeader colors={colors} safeAreaTop={insets.top} setStep={setStep} step={step} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <PersonalInformationSection
            colors={colors}
            errors={errors}
            form={form}
            maxDobDate={maxDobDate}
            selfieUri={selfieUri}
            takeSelfie={takeSelfie}
            update={update}
            updateCascade={updateCascade}
            user={user}
          />
        )}
        {step === 1 && (
          <VehicleInformationSection
            colors={colors}
            errors={errors}
            form={form}
            handlePlateChange={handlePlateChange}
            plateWarning={plateWarning}
            setErrors={setErrors}
            update={update}
          />
        )}
        {step === 2 && (
          <DocumentUploadSection
            colors={colors}
            docs={docs}
            errors={errors}
            pickDocument={pickDocument}
            takeDocumentPhoto={takeDocumentPhoto}
          />
        )}
        {step === 3 && (
          <RequirementsSection
            acceptedTerms={acceptedTerms}
            colors={colors}
            errors={errors}
            form={form}
            setAcceptedTerms={setAcceptedTerms}
            setErrors={setErrors}
            update={update}
          />
        )}
        <AppButton
          title={step < 3 ? 'Continue' : 'Submit Registration'}
          onPress={handleNext}
          fullWidth
          size="lg"
          loading={loading}
          disabled={step === 3 && !acceptedTerms}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
