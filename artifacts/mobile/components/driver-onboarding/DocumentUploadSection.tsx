import { AppText } from '@/components/AppText';
import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePickerField } from '@/components/DatePickerField';
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

export function DocumentUploadSection({ colors, docs, errors, form, vehiclePhotos, takeVehiclePhoto, takeDocumentPhoto, update }: {
  colors: ReturnType<typeof useColors>; docs: Record<DocumentKey, DocFaces>; errors: Record<string, string>; form: DriverOnboardingForm;
  vehiclePhotos?: Record<VehiclePhotoKey, string | null>;
  takeVehiclePhoto?: (key: VehiclePhotoKey) => Promise<void>;
  takeDocumentPhoto: (key: DocumentKey, face: 0 | 1) => Promise<void>;
  update: (field: string, value: string) => void;
}) {
  const minimumExpiryDate = new Date();
  minimumExpiryDate.setHours(0, 0, 0, 0);
  minimumExpiryDate.setDate(minimumExpiryDate.getDate() + 1);

  return <View style={styles.section}>
    <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Document Photos</AppText>
    <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Capture clear photos of each document. Driver's licence and National ID require front and back photos.</AppText>
    {DOCUMENTS.map(document => <View key={document.key} style={styles.docRow}>
      <View style={styles.docHeader}><AppText style={[styles.docLabel, { color: colors.foreground }]}>{document.label}<AppText style={{ color: colors.destructive }}> *</AppText></AppText><AppText style={[styles.docHint, { color: colors.mutedForeground }]}>{document.hint}</AppText></View>
      {EXPIRY_FIELDS[document.key] ? <DatePickerField label="Expiry date" value={form[EXPIRY_FIELDS[document.key]!]} onChange={value => update(EXPIRY_FIELDS[document.key]!, value)} error={errors[EXPIRY_FIELDS[document.key]!]} placeholder="DD/MM/YYYY" minimumDate={minimumExpiryDate} /> : null}
      <AppText style={[styles.docFaceLabel, { color: colors.mutedForeground }]}>Front face</AppText>
      <DocumentFace colors={colors} uri={docs[document.key][0]} hasError={Boolean(errors[document.key])} onTake={() => takeDocumentPhoto(document.key, 0)} captureLabel="Take Front Photo" />
      {errors[document.key] ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors[document.key]}</AppText> : null}
      {docs[document.key][0] && DOCUMENTS_REQUIRING_BACK.includes(document.key) && <><AppText style={[styles.docFaceLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Back face</AppText>
        <DocumentFace colors={colors} uri={docs[document.key][1]} hasError={Boolean(errors[document.key])} onTake={() => takeDocumentPhoto(document.key, 1)} captureLabel="Take Back Photo" />
      </>}
    </View>)}
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
            <AppText style={[styles.docFaceLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Inside photo</AppText>
            <DocumentFace colors={colors} uri={vehiclePhotos.inside} hasError={Boolean(errors.vehicleInsidePhoto)} onTake={() => takeVehiclePhoto('inside')} captureLabel="Take Inside Photo" />
            {errors.vehicleInsidePhoto ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors.vehicleInsidePhoto}</AppText> : null}
          </>
        ) : null}
      </View>
    ) : null}
  </View>;
}

function DocumentFace({ captureLabel, colors, hasError, onTake, uri }: {
  captureLabel: string; colors: ReturnType<typeof useColors>; hasError: boolean; onTake: () => void; uri: string | null;
}) {
  if (uri) {
    return (
      <View style={styles.docPreviewCard}>
        <Image source={{ uri }} style={styles.docThumb} resizeMode="cover" />
        <View style={styles.docPreviewContent}>
          <View style={styles.docCapturedRow}>
            <View style={[styles.docCapturedIcon, { backgroundColor: colors.successHex + '18' }]}>
              <Feather name="check" size={14} color={colors.success} />
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
  return <CaptureAction colors={colors} hasError={hasError} label={captureLabel} onPress={onTake} />;
}

function SmallAction({ colors, label, onPress }: { colors: ReturnType<typeof useColors>; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docChangeBtn, { borderColor: colors.border }]} onPress={onPress}><Feather name="camera" size={13} color={colors.foreground} /><AppText style={[styles.docChangeBtnText, { color: colors.foreground }]}>{label}</AppText></TouchableOpacity>;
}

function CaptureAction({ colors, hasError, label, onPress }: { colors: ReturnType<typeof useColors>; hasError: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docUploadBtn, { borderColor: hasError ? colors.destructive : colors.border, backgroundColor: colors.card }]} onPress={onPress}><Feather name="camera" size={20} color={colors.primary} /><AppText style={[styles.docUploadText, { color: colors.primary }]}>{label}</AppText></TouchableOpacity>;
}
