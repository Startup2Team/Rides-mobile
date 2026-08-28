import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { buildInitialDriverDocuments } from '@/domain/driverDocuments';
import { saveStoredDriverDocuments } from '@/persistence/driverDocumentsPersistence';
import { getLatestDriverApplicationRejectionSummary, submitDriverApplication, type DriverApplicationRejectionSummary } from '@/domain/verificationSubmissions';
import { DOCUMENTS } from '@/components/driver-onboarding/onboardingData';
import type { DocFaces, DocumentKey, VehiclePhotoKey } from '@/hooks/driver-onboarding/onboardingTypes';
import { getRequiredVehiclePhotoKeys } from '@/hooks/driver-onboarding/onboardingTypes';
import { isValidImageAsset } from '@/utils/documentValidation';
import { navigateToCustomerHomeAfterCompletion, replaceFlowScreen } from '@/navigation/navigationPolicy';
import { profileRepository } from '@/domains/profile/repository';
import { submitDriverApplicationWithDocuments, type DriverApplicationDocument, type DriverApplicationSubmitResult } from '@/services/driverApplication';
import { reportOperationalFailure } from '@/observability/monitoring';
import { readBackendError } from '@/utils/backendErrorMessage';

export default function DriverOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { driverProfile, user, saveDriverProfile, switchMode, refreshDriverProfile } = useAuth();
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
    rejectedDocuments: rejectionSummary?.rejectedDocuments,
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
        if (summary.rejectedFields && summary.rejectedFields.some(f => ['brand', 'model', 'plateNumber'].includes(f))) {
          setStep(0);
        } else if (summary.rejectedFields && summary.rejectedFields.some(f => ['licenseNumber', 'nationalId', 'dob', 'province', 'district', 'sector', 'cell', 'village', 'momoCode'].includes(f))) {
          setStep(1);
        } else if (summary.rejectedDocuments && summary.rejectedDocuments.length > 0) {
          setStep(2);
        }
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
    if (selfieUri) await profileRepository.saveProfileImage(selfieUri);
    setLoading(false);
    navigateToCustomerHomeAfterCompletion(router);
  };

  const saveAndContinue = async () => {
    setDraftLoaded(false);
    setLoading(true);

    const documents: DriverApplicationDocument[] = [];
    if (docs.license?.[0]) documents.push({ documentType: 'LICENCE_FRONT', uri: docs.license[0] });
    if (docs.license?.[1]) documents.push({ documentType: 'LICENCE_BACK', uri: docs.license[1] });
    if (docs.nationalId?.[0]) documents.push({ documentType: 'NATIONAL_ID_FRONT', uri: docs.nationalId[0] });
    if (docs.nationalId?.[1]) documents.push({ documentType: 'NATIONAL_ID_BACK', uri: docs.nationalId[1] });
    if (docs.insurance?.[0]) documents.push({ documentType: 'VEHICLE_INSURANCE', uri: docs.insurance[0] });
    if (docs.authorization?.[0]) documents.push({ documentType: 'VEHICLE_AUTHORIZATION', uri: docs.authorization[0] });
    if (selfieUri) documents.push({ documentType: 'SELFIE', uri: selfieUri });

    // Real backend: create the driver application, then upload every KYC
    // document. This is the ONLY thing that actually resubmits a rejected /
    // needs-more-info application — the backend flips the status back to
    // PENDING_REVIEW when (and only when) this succeeds. It must never be
    // faked or swallowed: a network failure here used to be silently eaten
    // while the app still told the driver "Application Submitted!" and wrote
    // a local pending_review status that the backend never agreed with.
    let result: DriverApplicationSubmitResult;
    try {
      result = await submitDriverApplicationWithDocuments(
        {
          vehicleType: form.vehicleType,
          vehiclePlate: form.plateNumber,
          licenseNumber: form.licenseNumber,
          dateOfBirth: form.dob,
          city: form.district || form.province,
          momoPayCode: form.momoCode,
          momoProvider: form.momoProvider,
          province: form.province,
          district: form.district,
          sector: form.sector,
          cell: form.cell,
          village: form.village,
          // Client-validated required at step 0 (useDriverOnboardingValidation);
          // nationalIdCountry can only be '' if that validation was bypassed.
          nationalIdNumber: form.nationalId,
          nationalIdCountry: form.nationalIdCountry || 'RW',
          gender: form.gender || undefined,
          passengerSeats: form.passengerSeats ? Number(form.passengerSeats) : undefined,
          loadCapacityKg: form.loadCapacityKg ? Number(form.loadCapacityKg) : undefined,
          licenseExpiryDate: form.licenseExpiryDate || undefined,
          insuranceExpiryDate: form.insuranceExpiryDate || undefined,
          authorizationExpiryDate: form.authorizationExpiryDate || undefined,
        },
        documents,
      );
    } catch (error) {
      reportOperationalFailure('driver.application.submit', error);
      // Check if the backend genuinely created the application (e.g., 409 duplicate
      // credentials or secondary network drop after driver_profiles insertion).
      const backendSynced = await refreshDriverProfile();
      if (backendSynced || driverProfile?.verificationStatus === 'pending_review') {
        const pendingProfile: DriverProfile = buildPendingDriverProfile(form, selfieUri);
        await saveDriverProfile(pendingProfile);
        await removeStoredDriverOnboardingDraft();
        await switchMode('customer');
        setLoading(false);
        replaceFlowScreen(router, '/driver-submission-confirmation');
        return;
      }

      const backendError = readBackendError(error);
      setLoading(false);
      setDraftLoaded(true);
      Alert.alert(
        "Couldn't submit application",
        backendError.message ?? "We couldn't reach the server. Check your connection and try again.",
      );
      // Nothing was recorded as pending and the draft stays intact — the
      // driver stays on the form and can retry the same submission.
      return;
    }

    if (!result.allDocumentsUploaded) {
      const failedCount = result.documentResults.filter(item => !item.ok).length;
      reportOperationalFailure('driver.application.partialDocuments', undefined, { failedCount });
      Alert.alert(
        'Some documents failed to upload',
        `Your application was submitted, but ${failedCount} document${failedCount === 1 ? '' : 's'} didn't upload. Open Driver Documents from your profile to retry the missing ones — review can't finish without them.`,
      );
    }

    // The application genuinely reached the backend at this point (and
    // whatever documents made it are already there) — only now is it safe to
    // mirror a pending status locally and persist the local document cache.
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
    if (selfieUri) await profileRepository.saveProfileImage(selfieUri);

    await removeStoredDriverOnboardingDraft();
    await switchMode('customer');
    setLoading(false);
    replaceFlowScreen(router, '/driver-submission-confirmation');
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
            rejectedDocuments={rejectionSummary?.rejectedDocuments}
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
