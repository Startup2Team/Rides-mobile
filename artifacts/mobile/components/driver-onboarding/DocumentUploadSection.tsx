import { AppText } from '@/components/AppText';
import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePickerField } from '@/components/DatePickerField';
import { icons } from '@/constants/icons';
import { spacing } from '@/constants/spacing';
import type { useColors } from '@/hooks/useColors';
import type { DocFaces, DocumentKey, DriverOnboardingForm, VehiclePhotoKey } from '@/hooks/driver-onboarding/onboardingTypes';
import { getRequiredVehiclePhotoKeys } from '@/hooks/driver-onboarding/onboardingTypes';
import { DOCUMENTS } from './onboardingData';
import { styles } from './onboardingStyles';
import { DOCUMENTS_REQUIRING_BACK } from '@/domain/driverDocuments';

const EXPIRY_FIELDS: Partial<Record<DocumentKey, keyof Pick<DriverOnboardingForm, 'licenseExpiryDate' | 'insuranceExpiryDate' | 'authorizationExpiryDate'>>> = {
  license: 'licenseExpiryDate',
  insurance: 'insuranceExpiryDate',
  authorization: 'authorizationExpiryDate',
};

export function DocumentUploadSection({ approvedDocuments = [], rejectedDocuments = [], colors, docs, errors, form, vehiclePhotos, takeVehiclePhoto, takeDocumentPhoto, update }: {
  approvedDocuments?: DocumentKey[];
  rejectedDocuments?: string[];
  colors: ReturnType<typeof useColors>; docs: Record<DocumentKey, DocFaces>; errors: Record<string, string>; form: DriverOnboardingForm;
  vehiclePhotos?: Record<VehiclePhotoKey, string | null>;
  takeVehiclePhoto?: (key: VehiclePhotoKey) => Promise<void>;
  takeDocumentPhoto: (key: DocumentKey, face: 0 | 1) => Promise<void>;
  update: (field: string, value: string) => void;
}) {
  const minimumExpiryDate = new Date();
  minimumExpiryDate.setHours(0, 0, 0, 0);
  minimumExpiryDate.setDate(minimumExpiryDate.getDate() + 1);

  const displayDocuments = DOCUMENTS.filter(doc => {
    if (rejectedDocuments && rejectedDocuments.length > 0) {
      return rejectedDocuments.includes(doc.key);
    }
    return true;
  });

  return <View style={styles.section}>
    <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Document Photos</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
      {rejectedDocuments && rejectedDocuments.length > 0
        ? 'Please update ONLY the specific document(s) requested for review below.'
        : 'Capture clear photos of each document. Approved items are locked and do not require re-uploading.'}
    </AppText>
    {displayDocuments.map(document => {
      const isApproved = approvedDocuments.includes(document.key);
      const isNeedsUpdate = rejectedDocuments && rejectedDocuments.includes(document.key);
      return (
        <View
          key={document.key}
          style={[
            styles.docRow,
            isNeedsUpdate && {
              borderColor: '#F59E0B',
              borderWidth: 1.5,
              backgroundColor: 'rgba(245, 158, 11, 0.06)',
              borderRadius: 16,
              padding: spacing[4],
            },
          ]}
        >
          {isNeedsUpdate && (
            <View
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.35)',
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.foreground, flex: 1 }}>
                Update required: Reviewer requested a new photo for this document. Tap below to capture.
              </AppText>
            </View>
          )}
          <View style={styles.docHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <AppText style={[styles.docLabel, { color: colors.foreground }]}>
                {document.label}{!isApproved && <AppText style={{ color: colors.destructive }}> *</AppText>}
              </AppText>
              {isNeedsUpdate && (
                <View
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                  }}
                >
                  <AppText style={{ fontSize: 10, fontWeight: '700', color: '#D97706', textTransform: 'uppercase' }}>
                    🟨 Update required
                  </AppText>
                </View>
              )}
            </View>
            <AppText style={[styles.docHint, { color: colors.mutedForeground }]}>{document.hint}</AppText>
          </View>
          {EXPIRY_FIELDS[document.key] ? <DatePickerField label="Expiry date" value={form[EXPIRY_FIELDS[document.key]!]} onChange={value => update(EXPIRY_FIELDS[document.key]!, value)} error={errors[EXPIRY_FIELDS[document.key]!]} placeholder="DD/MM/YYYY" minimumDate={minimumExpiryDate} disabled={isApproved} /> : null}
          <AppText style={[styles.docFaceLabel, { color: colors.mutedForeground }]}>Front face</AppText>
          <DocumentFace colors={colors} uri={docs[document.key][0]} hasError={Boolean(errors[document.key])} onTake={() => takeDocumentPhoto(document.key, 0)} captureLabel={isNeedsUpdate ? 'Tap to Update Front Photo' : 'Take Front Photo'} isApproved={isApproved} isNeedsUpdate={isNeedsUpdate} />
          {errors[document.key] ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors[document.key]}</AppText> : null}
          {docs[document.key][0] && DOCUMENTS_REQUIRING_BACK.includes(document.key) && <><AppText style={[styles.docFaceLabel, { color: colors.mutedForeground, marginTop: spacing[4] }]}>Back face</AppText>
            <DocumentFace colors={colors} uri={docs[document.key][1]} hasError={Boolean(errors[document.key])} onTake={() => takeDocumentPhoto(document.key, 1)} captureLabel={isNeedsUpdate ? 'Tap to Update Back Photo' : 'Take Back Photo'} isApproved={isApproved} isNeedsUpdate={isNeedsUpdate} />
          </>}
        </View>
      );
    })}
    {vehiclePhotos && takeVehiclePhoto && getRequiredVehiclePhotoKeys(form.vehicleType).length > 0 ? (
      <View style={styles.docRow}>
        <View style={styles.docHeader}>
          <AppText style={[styles.docLabel, { color: colors.foreground }]}>Vehicle Photos<AppText style={{ color: colors.destructive }}> *</AppText></AppText>
          <AppText style={[styles.docHint, { color: colors.mutedForeground }]}>
            {getRequiredVehiclePhotoKeys(form.vehicleType).length === 2
              ? 'Exterior and interior photos are required for this vehicle type.'
              : 'Exterior photo is required for this vehicle type.'}
          </AppText>
        </View>
        <AppText style={[styles.docFaceLabel, { color: colors.mutedForeground }]}>Outside photo</AppText>
        <DocumentFace colors={colors} uri={vehiclePhotos.outside} hasError={Boolean(errors.vehicleOutsidePhoto)} onTake={() => takeVehiclePhoto('outside')} captureLabel="Take Outside Photo" />
        {errors.vehicleOutsidePhoto ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors.vehicleOutsidePhoto}</AppText> : null}
        {getRequiredVehiclePhotoKeys(form.vehicleType).includes('inside') ? (
          <>
            <AppText style={[styles.docFaceLabel, { color: colors.mutedForeground, marginTop: spacing[4] }]}>Inside photo</AppText>
            <DocumentFace colors={colors} uri={vehiclePhotos.inside} hasError={Boolean(errors.vehicleInsidePhoto)} onTake={() => takeVehiclePhoto('inside')} captureLabel="Take Inside Photo" />
            {errors.vehicleInsidePhoto ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors.vehicleInsidePhoto}</AppText> : null}
          </>
        ) : null}
      </View>
    ) : null}
  </View>;
}

function DocumentFace({ captureLabel, colors, hasError, isApproved, isNeedsUpdate, onTake, uri }: {
  captureLabel: string; colors: ReturnType<typeof useColors>; hasError: boolean; isApproved?: boolean; isNeedsUpdate?: boolean; onTake: () => void; uri: string | null;
}) {
  if (uri && isApproved) {
    return (
      <View style={[styles.docPreviewCard, { borderColor: colors.successHex + '40' }]}>
        <Image source={{ uri }} style={styles.docThumb} resizeMode="cover" />
        <View style={styles.docPreviewContent}>
          <View style={styles.docCapturedRow}>
            <View style={[styles.docCapturedIcon, { backgroundColor: colors.successHex + '20' }]}>
              <Feather name="check" size={icons.size.xs} color={colors.success} />
            </View>
            <View style={styles.docCapturedCopy}>
              <AppText style={[styles.docUploadedText, { color: colors.success }]}>Approved & Verified</AppText>
            </View>
          </View>
        </View>
      </View>
    );
  }
  if (uri && isNeedsUpdate) {
    return (
      <View style={[styles.docPreviewCard, { borderColor: '#F59E0B' }]}>
        <Image source={{ uri }} style={styles.docThumb} resizeMode="cover" />
        <View style={styles.docPreviewContent}>
          <View style={styles.docCapturedRow}>
            <View style={[styles.docCapturedIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Feather name="alert-circle" size={icons.size.xs} color="#D97706" />
            </View>
            <View style={styles.docCapturedCopy}>
              <AppText style={[styles.docUploadedText, { color: '#D97706' }]}>Update Required</AppText>
            </View>
          </View>
          <SmallAction colors={colors} label="Update Photo 📷" onPress={onTake} />
        </View>
      </View>
    );
  }
  if (uri) {
    return (
      <View style={styles.docPreviewCard}>
        <Image source={{ uri }} style={styles.docThumb} resizeMode="cover" />
        <View style={styles.docPreviewContent}>
          <View style={styles.docCapturedRow}>
            <View style={[styles.docCapturedIcon, { backgroundColor: colors.successHex + '18' }]}>
              <Feather name="check" size={icons.size.xs} color={colors.success} />
            </View>
            <View style={styles.docCapturedCopy}>
              <AppText style={[styles.docUploadedText, { color: colors.foreground }]}>Photo captured</AppText>
            </View>
          </View>
          <SmallAction colors={colors} label="Retake Photo" onPress={onTake} />
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[
        styles.docUploadBtn,
        {
          borderColor: isNeedsUpdate ? '#F59E0B' : hasError ? colors.destructive : colors.border,
          backgroundColor: isNeedsUpdate ? 'rgba(245, 158, 11, 0.12)' : colors.card,
        },
      ]}
      onPress={onTake}
    >
      <Feather name="camera" size={icons.size.lg} color={isNeedsUpdate ? '#D97706' : colors.primary} />
      <AppText style={[styles.docUploadText, { color: isNeedsUpdate ? '#D97706' : colors.primary, fontWeight: '700' }]}>
        {captureLabel}
      </AppText>
    </TouchableOpacity>
  );
}

function SmallAction({ colors, label, onPress }: { colors: ReturnType<typeof useColors>; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docChangeBtn, { borderColor: colors.border }]} onPress={onPress}><Feather name="camera" size={13} color={colors.foreground} /><AppText style={[styles.docChangeBtnText, { color: colors.foreground }]}>{label}</AppText></TouchableOpacity>;
}

function CaptureAction({ colors, hasError, label, onPress }: { colors: ReturnType<typeof useColors>; hasError: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docUploadBtn, { borderColor: hasError ? colors.destructive : colors.border, backgroundColor: colors.card }]} onPress={onPress}><Feather name="camera" size={icons.size.lg} color={colors.primary} /><AppText style={[styles.docUploadText, { color: colors.primary }]}>{label}</AppText></TouchableOpacity>;
}
