import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { ImageGalleryPreview, type GalleryImage } from '@/components/ImageGalleryPreview';
import { DocumentUploadSection } from '@/components/driver-onboarding/DocumentUploadSection';
import { PersonalInformationSection } from '@/components/driver-onboarding/PersonalInformationSection';
import { ProgressHeader } from '@/components/driver-onboarding/ProgressHeader';
import { RequirementsSection } from '@/components/driver-onboarding/RequirementsSection';
import { ReviewSubmissionSection } from '@/components/driver-onboarding/ReviewSubmissionSection';
import { VehicleInformationSection } from '@/components/driver-onboarding/VehicleInformationSection';
import { DriverApplicationRejectionBanner } from '@/components/driver-onboarding/DriverApplicationRejectionBanner';
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
import { getLatestDriverApplicationRejectionSummary, submitDriverApplication, type DriverApplicationRejectionSummary } from '@/domain/verificationSubmissions';
import { DOCUMENTS } from '@/components/driver-onboarding/onboardingData';
import type { DocFaces, DocumentKey, VehiclePhotoKey } from '@/hooks/driver-onboarding/onboardingTypes';
import { getRequiredVehiclePhotoKeys } from '@/hooks/driver-onboarding/onboardingTypes';
import { isValidImageAsset } from '@/utils/documentValidation';

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { driverProfile, user, saveDriverProfile, switchMode } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [rejectionSummary, setRejectionSummary] = useState<DriverApplicationRejectionSummary | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<VehiclePhotoKey, string | null>>({
    outside: null,
    inside: null,
  });
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
    selfieUri,
    setDocs,
    setSelfieUri,
    takeDocumentPhoto,
    takeSelfie,
  } = useDriverDocumentUpload(setErrors);
  const reviewImages = React.useMemo<GalleryImage[]>(
    () => buildOnboardingReviewImages(form.vehicleType, docs, selfieUri, vehiclePhotos),
    [docs, form.vehicleType, selfieUri, vehiclePhotos],
  );
  const validate = useDriverOnboardingValidation({
    acceptedTerms,
    docs,
    form,
    vehiclePhotos,
    selfieUri,
    step,
  });

  useEffect(() => {
    void (async () => {
      const stored = await loadStoredDriverOnboardingDraft();
      if (stored.data) {
        setForm(stored.data.form);
        setDocs(stored.data.docs);
        setVehiclePhotos(stored.data.vehiclePhotos ?? { outside: null, inside: null });
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
    if (driverProfile?.verificationStatus !== 'rejected' || !user?.id) {
      setRejectionSummary(null);
      return;
    }

    void (async () => {
      const summary = await getLatestDriverApplicationRejectionSummary(user.id);
      setRejectionSummary(summary);
      if (summary) {
        setErrors(current => ({ ...current, ...buildRejectionErrors(summary) }));
      }
    })();
  }, [draftLoaded, driverProfile?.verificationStatus, setErrors, user?.id]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      void saveStoredDriverOnboardingDraft({
        form,
        docs,
        vehiclePhotos,
        selfieUri,
        acceptedTerms,
        step,
        updatedAt: new Date().toISOString(),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [acceptedTerms, docs, draftLoaded, form, selfieUri, step, vehiclePhotos]);

  const saveDraftAndExit = async () => {
    setLoading(true);
    await saveStoredDriverOnboardingDraft({ form, docs, vehiclePhotos, selfieUri, acceptedTerms, step, updatedAt: new Date().toISOString() });
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
      vehiclePhotos: buildVehiclePhotosPayload(form.vehicleType, vehiclePhotos),
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
          <>
            <DriverApplicationRejectionBanner
              colors={colors}
              rejectionReason={driverProfile?.rejectionReason}
              rejectionSummary={rejectionSummary}
            />
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
          </>
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
            vehiclePhotos={vehiclePhotos}
            takeVehiclePhoto={async key => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') return;
              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.88, allowsEditing: false });
              if (result.canceled || !result.assets[0] || !isValidImageAsset(result.assets[0])) return;
              setVehiclePhotos(current => ({ ...current, [key]: result.assets[0].uri }));
              setErrors(current => ({ ...current, [key === 'outside' ? 'vehicleOutsidePhoto' : 'vehicleInsidePhoto']: '' }));
            }}
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
        {step === 4 && (
          <>
            <DriverApplicationRejectionBanner
              colors={colors}
              rejectionReason={driverProfile?.rejectionReason}
              rejectionSummary={rejectionSummary}
            />
            <ReviewSubmissionSection
              colors={colors}
              form={form}
              onOpenImagePreview={index => {
                setPreviewIndex(index);
                setPreviewVisible(true);
              }}
              previewImages={reviewImages}
            />
          </>
        )}
        <AppButton
          title={step < 4 ? 'Continue' : 'Submit Registration'}
          onPress={handleNext}
          fullWidth
          size="lg"
          loading={loading}
          disabled={step === 3 && !acceptedTerms}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton title="Save and exit" onPress={saveDraftAndExit} size="sm" compact variant="secondary" loading={loading} style={{ flex: 1 }} />
        <AppButton title="Contact Support" onPress={() => router.push('/help-support')} size="sm" compact variant="plain" style={{ flex: 1 }} />
      </View>
      </ScrollView>
      <ImageGalleryPreview
        images={reviewImages}
        initialIndex={previewIndex}
        onClose={() => setPreviewVisible(false)}
        visible={step === 4 && previewVisible}
      />
    </KeyboardAvoidingView>
  );
}

function buildOnboardingReviewImages(
  vehicleType: DriverProfile['vehicleType'],
  docs: Record<DocumentKey, DocFaces>,
  selfieUri: string | null,
  vehiclePhotos: Record<VehiclePhotoKey, string | null>,
): GalleryImage[] {
  const images: GalleryImage[] = [];
  if (selfieUri) {
    images.push({
      id: 'selfie',
      uri: selfieUri,
      title: 'Profile photo',
    });
  }

  DOCUMENTS.forEach(document => {
    const [front, back] = docs[document.key];
    if (front) {
      images.push({
        id: `${document.key}-front`,
        uri: front,
        title: `${document.label} - Front`,
      });
    }
    if (back) {
      images.push({
        id: `${document.key}-back`,
        uri: back,
        title: `${document.label} - Back`,
      });
    }
  });

  getRequiredVehiclePhotoKeys(vehicleType).forEach(key => {
    const uri = vehiclePhotos[key];
    if (!uri) return;
    images.push({
      id: `vehicle-${key}`,
      uri,
      title: key === 'outside' ? 'Vehicle outside photo' : 'Vehicle inside photo',
    });
  });

  return images;
}

function buildVehiclePhotosPayload(
  vehicleType: DriverProfile['vehicleType'],
  vehiclePhotos: Record<VehiclePhotoKey, string | null>,
) {
  const requiredKeys = getRequiredVehiclePhotoKeys(vehicleType);
  return requiredKeys.reduce<{ outside?: string | null; inside?: string | null }>((acc, key) => {
    acc[key] = vehiclePhotos[key];
    return acc;
  }, {});
}

function buildRejectionErrors(summary: DriverApplicationRejectionSummary) {
  const errors: Record<string, string> = {};
  summary.rejectedFields.forEach(field => {
    errors[field] = 'Please update this item.';
  });
  summary.rejectedDocuments.forEach(document => {
    errors[document] = 'Please retake this photo.';
  });
  return errors;
}
