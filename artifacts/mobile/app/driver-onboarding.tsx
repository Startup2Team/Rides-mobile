import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { DocumentUploadSection } from '@/components/driver-onboarding/DocumentUploadSection';
import { PersonalInformationSection } from '@/components/driver-onboarding/PersonalInformationSection';
import { ProgressHeader } from '@/components/driver-onboarding/ProgressHeader';
import { RequirementsSection } from '@/components/driver-onboarding/RequirementsSection';
import { ReviewSubmissionSection } from '@/components/driver-onboarding/ReviewSubmissionSection';
import { VehicleInformationSection } from '@/components/driver-onboarding/VehicleInformationSection';
import { styles } from '@/components/driver-onboarding/onboardingStyles';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useDriverDocumentUpload } from '@/hooks/driver-onboarding/useDriverDocumentUpload';
import { useDriverOnboardingForm } from '@/hooks/driver-onboarding/useDriverOnboardingForm';
import { useDriverOnboardingValidation } from '@/hooks/driver-onboarding/useDriverOnboardingValidation';
import type { DriverProfile } from '@/types';
import { buildDraftDriverProfile, buildPendingDriverProfile, formFromDriverProfile } from '@/hooks/driver-onboarding/onboardingSubmission';
import { loadStoredDriverOnboardingDraft, removeStoredDriverOnboardingDraft, saveStoredDriverOnboardingDraft } from '@/persistence/driverOnboardingPersistence';
import { saveStoredProfileImage } from '@/persistence/profilePersistence';
import { buildInitialDriverDocuments } from '@/domain/driverDocuments';
import { saveStoredDriverDocuments } from '@/persistence/driverDocumentsPersistence';
import { submitDriverApplication } from '@/domain/verificationSubmissions';

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { driverProfile, user, saveDriverProfile, switchMode } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const {
    errors,
    form,
    handlePlateChange,
    maxDobDate,
    plateWarning,
    setErrors,
    setForm,
    update,
    updateCascade,
  } = useDriverOnboardingForm();
  const {
    docs,
    pickDocument,
    selfieUri,
    setDocs,
    setSelfieUri,
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

  useEffect(() => {
    void (async () => {
      const stored = await loadStoredDriverOnboardingDraft();
      if (stored.data) {
        setForm(stored.data.form);
        setDocs(stored.data.docs);
        setSelfieUri(stored.data.selfieUri);
        setAcceptedTerms(stored.data.acceptedTerms);
        setStep(stored.data.step);
      } else if (driverProfile?.verificationStatus === 'rejected' || driverProfile?.verificationStatus === 'draft') {
        setForm(formFromDriverProfile(driverProfile));
        setSelfieUri(driverProfile.profileImage ?? null);
      }
      setDraftLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      void saveStoredDriverOnboardingDraft({
        form,
        docs,
        selfieUri,
        acceptedTerms,
        step,
        updatedAt: new Date().toISOString(),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [acceptedTerms, docs, draftLoaded, form, selfieUri, step]);

  const saveDraftAndExit = async () => {
    setLoading(true);
    await saveStoredDriverOnboardingDraft({ form, docs, selfieUri, acceptedTerms, step, updatedAt: new Date().toISOString() });
    await saveDriverProfile(buildDraftDriverProfile(form, selfieUri));
    if (selfieUri) await saveStoredProfileImage(selfieUri);
    setLoading(false);
    router.replace('/(tabs)');
  };

  const saveAndContinue = async () => {
    setDraftLoaded(false);
    setLoading(true);
    const profile: DriverProfile = buildPendingDriverProfile(form, selfieUri);
    await saveDriverProfile(profile);
    await saveStoredDriverDocuments(buildInitialDriverDocuments(form, docs));
    await submitDriverApplication({
      userId: user?.id ?? 'unknown-user',
      fullName: user?.name ?? 'Unknown driver',
      phone: user?.phone ?? profile.momoCode,
      driverProfile: profile,
      form,
      docs,
      selfieUri,
      submittedAt: new Date().toISOString(),
    });
    if (selfieUri) await saveStoredProfileImage(selfieUri);
    await removeStoredDriverOnboardingDraft();
    await switchMode('customer');
    setLoading(false);
    router.replace('/driver-submission-confirmation');
  };

  const handleNext = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    if (step < 4) {
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
      <ProgressHeader colors={colors} onExit={saveDraftAndExit} safeAreaTop={insets.top} setStep={setStep} step={step} />
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
            form={form}
            pickDocument={pickDocument}
            takeDocumentPhoto={takeDocumentPhoto}
            update={update}
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
        {step === 4 && <ReviewSubmissionSection colors={colors} docs={docs} form={form} />}
        <AppButton
          title={step < 4 ? 'Continue' : 'Submit Registration'}
          onPress={handleNext}
          fullWidth
          size="lg"
          loading={loading}
          disabled={step === 3 && !acceptedTerms}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton title="Save & exit" onPress={saveDraftAndExit} size="sm" compact variant="secondary" loading={loading} style={{ flex: 1 }} />
          <AppButton title="Contact Support" onPress={() => router.push('/help-support')} size="sm" compact variant="plain" style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
