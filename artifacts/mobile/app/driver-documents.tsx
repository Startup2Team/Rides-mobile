import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { Alert, Image, Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { DatePickerField } from '@/components/DatePickerField';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import {
  DOCUMENTS_REQUIRING_BACK,
  DRIVER_DOCUMENT_LABELS,
  buildDriverDocumentsFromProfile,
  getDriverDocumentDisplayStatus,
  reconcileDriverDocumentsWithProfile,
  type DriverDocumentDisplayStatus,
  type DriverDocuments,
} from '@/domain/driverDocuments';
import { useColors } from '@/hooks/useColors';
import { useDriverDocumentUpload } from '@/hooks/driver-onboarding/useDriverDocumentUpload';
import type { DocumentKey } from '@/hooks/driver-onboarding/onboardingTypes';
import { isFutureExpiryDate, isValidDriverLicenceNumber } from '@/hooks/driver-onboarding/useDriverOnboardingValidation';
import { loadStoredDriverDocuments, saveStoredDriverDocuments } from '@/persistence/driverDocumentsPersistence';
import { isValidDocumentImageUri } from '@/utils/documentValidation';
import { isValidRwandaNationalId } from '@/utils/rwandaValidation';
import { elevation } from '@/constants/elevation';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';

const DOCUMENT_ORDER: DocumentKey[] = ['license', 'nationalId', 'insurance', 'authorization'];
const EXPIRY_DOCUMENTS: DocumentKey[] = ['license', 'insurance', 'authorization'];

export default function DriverDocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile } = useAuth();
  const [documents, setDocuments] = React.useState<DriverDocuments | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [activeKey, setActiveKey] = React.useState<DocumentKey | null>(null);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      const stored = await loadStoredDriverDocuments();
      if (stored.data) {
        const reconciled = driverProfile ? reconcileDriverDocumentsWithProfile(stored.data, driverProfile) : stored.data;
        setDocuments(reconciled);
        if (reconciled !== stored.data) await saveStoredDriverDocuments(reconciled);
      } else if (driverProfile) {
        setDocuments(buildDriverDocumentsFromProfile(driverProfile));
      }
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [driverProfile]);
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const { docs, pickDocument, setDocs, takeDocumentPhoto } = useDriverDocumentUpload(setErrors);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  React.useEffect(() => {
    void loadStoredDriverDocuments().then(stored => {
      if (stored.data) {
        const reconciled = driverProfile ? reconcileDriverDocumentsWithProfile(stored.data, driverProfile) : stored.data;
        setDocuments(reconciled);
        if (reconciled !== stored.data) void saveStoredDriverDocuments(reconciled);
      } else if (driverProfile) {
        setDocuments(buildDriverDocumentsFromProfile(driverProfile));
      }
    });
  }, [driverProfile]);

  const beginReplacement = (key: DocumentKey) => {
    if (!documents) return;
    const record = documents[key];
    setActiveKey(key);
    setDocumentNumber(record.documentNumber ?? '');
    setExpiryDate(record.expiryDate ?? '');
    setDocs(current => ({ ...current, [key]: record.faces }));
    setErrors({});
  };

  const submitReplacement = async () => {
    if (!activeKey || !documents) return;
    const nextErrors: Record<string, string> = {};
    const faces = docs[activeKey];
    if (!faces[0] || !isValidDocumentImageUri(faces[0])) nextErrors.document = 'A valid front image is required';
    if (DOCUMENTS_REQUIRING_BACK.includes(activeKey) && (!faces[1] || !isValidDocumentImageUri(faces[1]))) {
      nextErrors.document = 'Valid front and back images are required';
    }
    if (activeKey === 'license' && !isValidDriverLicenceNumber(documentNumber)) {
      nextErrors.documentNumber = 'Driver licence number must be exactly 16 digits';
    }
    if (activeKey === 'nationalId' && !isValidRwandaNationalId(documentNumber)) {
      nextErrors.documentNumber = 'National ID must be exactly 16 digits';
    }
    if (EXPIRY_DOCUMENTS.includes(activeKey) && !isFutureExpiryDate(expiryDate)) {
      nextErrors.expiryDate = 'Expiry date must be in the future';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    const updated: DriverDocuments = {
      ...documents,
      [activeKey]: {
        ...documents[activeKey],
        faces,
        documentNumber: activeKey === 'license' || activeKey === 'nationalId' ? documentNumber : undefined,
        expiryDate: EXPIRY_DOCUMENTS.includes(activeKey) ? expiryDate : undefined,
        reviewStatus: 'pending_review',
        submissionKind: 'replacement',
        submittedAt: now,
        updatedAt: now,
      },
    };
    setSaving(true);
    await saveStoredDriverDocuments(updated);
    setDocuments(updated);
    setActiveKey(null);
    setSaving(false);
    Alert.alert('Submitted for review', `${DRIVER_DOCUMENT_LABELS[activeKey]} replacement was submitted. Your current verified details remain active during review.`);
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Driver Documents" />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{ paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING, paddingHorizontal: semanticSpacing.cardPadding, gap: icons.semantic.row }}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        <View style={[styles.notice, { backgroundColor: colors.primaryHex + '10' }]}>
          <Feather name="shield" size={icons.semantic.row} color={colors.primary} />
          <AppText style={[styles.noticeText, { color: colors.mutedForeground }]}>
            Replacements are reviewed before becoming your verified driver documents.
          </AppText>
        </View>

        {documents ? DOCUMENT_ORDER.map(key => {
          const record = documents[key];
          const status = getDriverDocumentDisplayStatus(record);
          return (
            <DocumentCard
              key={key}
              cardFill={cardFill}
              colors={colors}
              record={record}
              status={status}
              onReplace={() => beginReplacement(key)}
            >
              {activeKey === key ? (
                <ReplacementEditor
                  colors={colors}
                  documentKey={key}
                  documentNumber={documentNumber}
                  docs={docs}
                  errors={errors}
                  expiryDate={expiryDate}
                  onCamera={takeDocumentPhoto}
                  onClose={() => setActiveKey(null)}
                  onDocumentNumberChange={setDocumentNumber}
                  onExpiryDateChange={setExpiryDate}
                  onGallery={pickDocument}
                  onSubmit={submitReplacement}
                  saving={saving}
                />
              ) : null}
            </DocumentCard>
          );
        }) : (
          <AppText style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading driver documents...</AppText>
        )}
      </GlassScrollView>
    </View>
  );
}

function DocumentCard({ cardFill, children, colors, onReplace, record, status }: {
  cardFill: string;
  children?: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  onReplace: () => void;
  record: DriverDocuments[DocumentKey];
  status: DriverDocumentDisplayStatus;
}) {
  const statusColor = status === 'verified'
    ? colors.successHex
    : status === 'pending_review' || status === 'expiring_soon'
      ? colors.warningHex
      : colors.destructiveHex;
  const statusLabel = status === 'pending_review'
    ? 'Pending Review'
    : status === 'expiring_soon'
      ? 'Expiring Soon'
      : status.charAt(0).toUpperCase() + status.slice(1);
  const imageCount = record.faces.filter(Boolean).length;

  return (
    <View style={[styles.card, styles.cardShadow, { backgroundColor: cardFill }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <AppText style={[styles.cardTitle, { color: colors.foreground }]}>{DRIVER_DOCUMENT_LABELS[record.key]}</AppText>
          <AppText style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {record.documentNumber ? `Number: ${record.documentNumber}` : `${imageCount} image${imageCount === 1 ? '' : 's'} saved`}
          </AppText>
          {record.expiryDate ? <AppText style={[styles.cardMeta, { color: colors.mutedForeground }]}>Expires {record.expiryDate}</AppText> : null}
        </View>
        <View style={[styles.statusChip, { backgroundColor: statusColor + '14' }]}>
          <AppText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</AppText>
        </View>
      </View>
      <View style={styles.previewRow}>
        {record.faces.slice(0, DOCUMENTS_REQUIRING_BACK.includes(record.key) ? 2 : 1).map((uri, index) => uri ? <Image key={uri} source={{ uri }} style={styles.preview} /> : (
          <View key={index} style={[styles.preview, styles.emptyPreview, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={icons.semantic.button} color={colors.mutedForeground} />
          </View>
        ))}
        <TouchableOpacity style={[styles.replaceButton, { backgroundColor: colors.primary }]} onPress={onReplace}>
          <AppText style={[styles.replaceText, { color: colors.primaryForeground }]}>Update Document</AppText>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function ReplacementEditor({
  colors,
  documentKey,
  documentNumber,
  docs,
  errors,
  expiryDate,
  onCamera,
  onClose,
  onDocumentNumberChange,
  onExpiryDateChange,
  onGallery,
  onSubmit,
  saving,
}: {
  colors: ReturnType<typeof useColors>;
  documentKey: DocumentKey;
  documentNumber: string;
  docs: Record<DocumentKey, [string | null, string | null]>;
  errors: Record<string, string>;
  expiryDate: string;
  onCamera: (key: DocumentKey, face: 0 | 1) => Promise<void>;
  onClose: () => void;
  onDocumentNumberChange: (value: string) => void;
  onExpiryDateChange: (value: string) => void;
  onGallery: (key: DocumentKey, face: 0 | 1) => Promise<void>;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <View style={[styles.editor, { borderTopColor: colors.border }]}>
      <View style={styles.editorHeading}>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={[styles.editorTitle, { color: colors.foreground }]}>Replace {DRIVER_DOCUMENT_LABELS[documentKey]}</AppText>
          <AppText style={[styles.editorSubtitle, { color: colors.mutedForeground }]}>Upload clear and current document images.</AppText>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close document editor">
          <Feather name="x" size={icons.size.lg} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {(documentKey === 'license' || documentKey === 'nationalId') ? (
        <AppInput
          label={documentKey === 'license' ? 'Driver Licence Number' : 'National ID Number'}
          value={documentNumber}
          onChangeText={value => onDocumentNumberChange(value.replace(/\D/g, '').slice(0, 16))}
          keyboardType="numeric"
          maxLength={16}
          error={errors.documentNumber}
        />
      ) : null}

      {EXPIRY_DOCUMENTS.includes(documentKey) ? (
        <DatePickerField
          label="Expiry date"
          value={expiryDate}
          onChange={onExpiryDateChange}
          placeholder="DD/MM/YYYY"
          minimumDate={new Date()}
          error={errors.expiryDate}
        />
      ) : null}

      <FaceEditor
        colors={colors}
        label="Front image"
        uri={docs[documentKey][0]}
        onCamera={() => onCamera(documentKey, 0)}
        onGallery={() => onGallery(documentKey, 0)}
      />
      {DOCUMENTS_REQUIRING_BACK.includes(documentKey) ? (
        <FaceEditor
          colors={colors}
          label="Back image"
          uri={docs[documentKey][1]}
          onCamera={() => onCamera(documentKey, 1)}
          onGallery={() => onGallery(documentKey, 1)}
        />
      ) : null}
      {errors.document ? <AppText style={[styles.errorText, { color: colors.destructive }]}>{errors.document}</AppText> : null}
      <AppButton title="Submit Document Update" onPress={onSubmit} fullWidth size="lg" loading={saving} />
    </View>
  );
}

function FaceEditor({ colors, label, onCamera, onGallery, uri }: {
  colors: ReturnType<typeof useColors>;
  label: string;
  onCamera: () => void;
  onGallery: () => void;
  uri: string | null;
}) {
  return (
    <View style={styles.faceEditor}>
      <AppText style={[styles.faceLabel, { color: colors.foreground }]}>{label}</AppText>
      <View style={styles.faceRow}>
        {uri ? <Image source={{ uri }} style={styles.facePreview} /> : (
          <View style={[styles.facePreview, styles.emptyPreview, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={icons.size.lg} color={colors.mutedForeground} />
          </View>
        )}
        <TouchableOpacity style={[styles.faceAction, { backgroundColor: colors.muted }]} onPress={onGallery}>
          <Feather name="upload" size={15} color="#000" />
          <AppText style={[styles.faceActionText, { color: colors.foreground }]}>Gallery</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.faceAction, { backgroundColor: colors.muted }]} onPress={onCamera}>
          <Feather name="camera" size={15} color="#000" />
          <AppText style={[styles.faceActionText, { color: colors.foreground }]}>Camera</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[10], padding: spacing[14], borderRadius: radius['2xl'] },
  noticeText: { flex: 1, ...typography.caption, lineHeight: 18,  },
  loadingText: { textAlign: 'center', paddingVertical: 28, ...typography.label,  },
  card: { borderRadius: radius['3xl'], padding: 15, gap: spacing[14] },
  cardShadow: { ...elevation.card, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }) },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { ...typography.bodySmall,  },
  cardMeta: { ...typography.tiny,  },
  statusChip: { paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: 5, borderRadius: radius.pill },
  statusText: { ...typography.tiny,  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.inlineGap },
  preview: { width: 42, height: 42, borderRadius: 10 },
  emptyPreview: { alignItems: 'center', justifyContent: 'center' },
  replaceButton: { marginLeft: 'auto', paddingHorizontal: semanticSpacing.rowGap, paddingVertical: 9, borderRadius: radius.pill },
  replaceText: { ...typography.button },
  editor: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: semanticSpacing.cardPadding, gap: semanticSpacing.cardPadding },
  editorHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: semanticSpacing.rowGap },
  editorTitle: { ...typography.title,  },
  editorSubtitle: { ...typography.tiny,  },
  faceEditor: { gap: semanticSpacing.inlineGap },
  faceLabel: { ...typography.caption,  },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.inlineGap },
  facePreview: { width: sizes.avatar.lg, height: sizes.avatar.lg, borderRadius: radius.input },
  faceAction: { flex: 1, height: sizes.button.sm, borderRadius: radius.input, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
  faceActionText: { ...typography.button },
  errorText: { ...typography.tiny,  },
});
