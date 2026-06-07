import React from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DatePickerField } from '@/components/DatePickerField';
import type { useColors } from '@/hooks/useColors';
import type { DocFaces, DocumentKey, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { DOCUMENTS } from './onboardingData';
import { styles } from './onboardingStyles';

const EXPIRY_FIELDS: Record<DocumentKey, keyof Pick<DriverOnboardingForm, 'licenseExpiryDate' | 'insuranceExpiryDate' | 'authorizationExpiryDate'>> = {
  license: 'licenseExpiryDate',
  insurance: 'insuranceExpiryDate',
  authorization: 'authorizationExpiryDate',
};

export function DocumentUploadSection({ colors, docs, errors, form, pickDocument, takeDocumentPhoto, update }: {
  colors: ReturnType<typeof useColors>; docs: Record<DocumentKey, DocFaces>; errors: Record<string, string>; form: DriverOnboardingForm;
  pickDocument: (key: DocumentKey, face: 0 | 1) => Promise<void>; takeDocumentPhoto: (key: DocumentKey, face: 0 | 1) => Promise<void>;
  update: (field: string, value: string) => void;
}) {
  const minimumExpiryDate = new Date();
  minimumExpiryDate.setHours(0, 0, 0, 0);
  minimumExpiryDate.setDate(minimumExpiryDate.getDate() + 1);

  return <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Document Uploads</Text>
    <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>Front face of each document is required. Add the back face where applicable.</Text>
    {DOCUMENTS.map(document => <View key={document.key} style={styles.docRow}>
      <View style={styles.docHeader}><Text style={[styles.docLabel, { color: colors.foreground }]}>{document.label}<Text style={{ color: colors.destructive }}> *</Text></Text><Text style={[styles.docHint, { color: colors.mutedForeground }]}>{document.hint}</Text></View>
      <DatePickerField label="Expiry date" value={form[EXPIRY_FIELDS[document.key]]} onChange={value => update(EXPIRY_FIELDS[document.key], value)} error={errors[EXPIRY_FIELDS[document.key]]} placeholder="DD/MM/YYYY" minimumDate={minimumExpiryDate} />
      <Text style={[styles.docFaceLabel, { color: colors.mutedForeground }]}>Front face</Text>
      <DocumentFace cameraOnly={document.key === 'license'} colors={colors} uri={docs[document.key][0]} hasError={Boolean(errors[document.key])} onPick={() => pickDocument(document.key, 0)} onTake={() => takeDocumentPhoto(document.key, 0)} />
      {errors[document.key] ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors[document.key]}</Text> : null}
      {docs[document.key][0] && <><Text style={[styles.docFaceLabel, { color: colors.mutedForeground, marginTop: 4 }]}>Back face</Text>
        {docs[document.key][1] ? <DocumentFace cameraOnly={document.key === 'license'} colors={colors} uri={docs[document.key][1]} hasError={false} onPick={() => pickDocument(document.key, 1)} onTake={() => takeDocumentPhoto(document.key, 1)} />
          : <TouchableOpacity style={[styles.docAddBackBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => document.key === 'license' ? takeDocumentPhoto(document.key, 1) : Alert.alert('Add back face', 'Choose how to add the back face of this document.', [{ text: 'Take photo', onPress: () => takeDocumentPhoto(document.key, 1) }, { text: 'Upload from gallery', onPress: () => pickDocument(document.key, 1) }, { text: 'Cancel', style: 'cancel' }])}><Feather name="camera" size={15} color={colors.mutedForeground} /><Text style={[styles.docAddBackText, { color: colors.mutedForeground }]}>{document.key === 'license' ? 'Take back face photo' : 'Add another photo (back face)'}</Text></TouchableOpacity>}
      </>}
    </View>)}
  </View>;
}

function DocumentFace({ cameraOnly = false, colors, hasError, onPick, onTake, uri }: {
  cameraOnly?: boolean; colors: ReturnType<typeof useColors>; hasError: boolean; onPick: () => void; onTake: () => void; uri: string | null;
}) {
  if (uri) return <View style={styles.docPreviewRow}><Image source={{ uri }} style={styles.docThumb} resizeMode="cover" /><View style={{ flex: 1, gap: 6 }}><View style={[styles.docUploaded, { backgroundColor: colors.primaryHex + '15', borderColor: colors.primaryHex + '30' }]}><Feather name="check-circle" size={14} color={colors.primary} /><Text style={[styles.docUploadedText, { color: colors.primary }]}>Uploaded</Text></View><View style={styles.docActionRow}>{cameraOnly ? null : <SmallAction colors={colors} icon="image" label="Change" onPress={onPick} />}<SmallAction colors={colors} icon="camera" label="Retake" onPress={onTake} /></View></View></View>;
  return <View style={styles.docActionRow}>{cameraOnly ? null : <UploadAction colors={colors} hasError={hasError} icon="upload" label="Upload" onPress={onPick} />}<UploadAction colors={colors} hasError={hasError} icon="camera" label="Camera" onPress={onTake} /></View>;
}

function SmallAction({ colors, icon, label, onPress }: { colors: ReturnType<typeof useColors>; icon: 'image' | 'camera'; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docChangeBtn, { borderColor: colors.border }]} onPress={onPress}><Feather name={icon} size={13} color={colors.mutedForeground} /><Text style={[styles.docChangeBtnText, { color: colors.mutedForeground }]}>{label}</Text></TouchableOpacity>;
}

function UploadAction({ colors, hasError, icon, label, onPress }: { colors: ReturnType<typeof useColors>; hasError: boolean; icon: 'upload' | 'camera'; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.docUploadBtn, { borderColor: hasError ? colors.destructive : colors.border, backgroundColor: colors.card }]} onPress={onPress}><Feather name={icon} size={20} color={colors.primary} /><Text style={[styles.docUploadText, { color: colors.primary }]}>{label}</Text></TouchableOpacity>;
}
