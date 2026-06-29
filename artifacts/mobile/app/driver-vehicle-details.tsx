import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Modal, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { DatePickerField } from '@/components/DatePickerField';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import {
  ImageGalleryPreview,
  type GalleryImage,
} from '@/components/ImageGalleryPreview';
import { useAuth } from '@/context/AuthContext';
import { appendDriverVehicle, getDriverVehicleReviewHistory, getDriverVehicleTimeline, submitDriverVehicleDocumentUpdate } from '@/domain/driverVehicles';
import {
  getAuthorizationComplianceMessage,
  getAuthorizationComplianceStatus,
  getComplianceStatusLabel,
  getInsuranceComplianceMessage,
  getInsuranceComplianceStatus,
  getLicenseComplianceMessage,
  getLicenseComplianceStatus,
} from '@/domain/vehicleCompliance';
import { submitVehicleDocumentUpdate as submitVerificationVehicleDocumentUpdate } from '@/domain/verificationSubmissions';
import { useColors } from '@/hooks/useColors';
import { useVehicle } from '@/domains/vehicle';
import { VEHICLE_LABELS, type DriverVehicleDocumentRecord, type DriverVehicleDocumentSet } from '@/types';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';
import { isValidImageAsset } from '@/utils/documentValidation';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';

type PreviewTarget = { index: number } | null;
type UpdateTarget =
  | { kind: 'document'; key: keyof DriverVehicleDocumentSet; face: 0 | 1; label: string }
  | { kind: 'photo'; key: 'outside' | 'inside'; label: string };
type ExpiryDocumentKey = 'license' | 'insurance' | 'authorization';

export default function DriverVehicleDetailsScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { driverProfile, user, saveDriverProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      // Simulate status check/reload delay
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, []);
  const params = useLocalSearchParams<{ vehicleId?: string; updateDocument?: string }>();
  const vehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : null;
  const requestedUpdateDocument = typeof params.updateDocument === 'string' ? params.updateDocument : null;
  const vehicle = useVehicle(vehicleId);
  const [previewTarget, setPreviewTarget] = React.useState<PreviewTarget>(null);
  const [updateTarget, setUpdateTarget] = React.useState<UpdateTarget | null>(null);
  const [draftDocuments, setDraftDocuments] = React.useState<DriverVehicleDocumentSet | null>(null);
  const [draftPhotos, setDraftPhotos] = React.useState<{ outside: string | null; inside: string | null } | null>(null);
  const [expiryTarget, setExpiryTarget] = React.useState<{ key: ExpiryDocumentKey; label: string } | null>(null);
  const [replacementExpiryDate, setReplacementExpiryDate] = React.useState('');
  const [replacementExpiryError, setReplacementExpiryError] = React.useState<string | undefined>();
  const [savingUpdate, setSavingUpdate] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const updateDocumentAutoOpenedRef = React.useRef(false);

  React.useEffect(() => {
    if (!vehicle) return;
    setDraftDocuments(vehicle.pendingDocumentUpdate?.documents ?? vehicle.documents ?? null);
    setDraftPhotos(
      {
        outside: vehicle.pendingDocumentUpdate?.photos?.outside ?? vehicle.photos?.outside ?? null,
        inside: vehicle.pendingDocumentUpdate?.photos?.inside ?? vehicle.photos?.inside ?? null,
      },
    );
    setUpdateTarget(null);
    setHasUnsavedChanges(false);
    updateDocumentAutoOpenedRef.current = false;
  }, [vehicle]);

  React.useEffect(() => {
    if (!vehicle || !requestedUpdateDocument || updateDocumentAutoOpenedRef.current) return;
    if (vehicle.status !== 'approved' || vehicle.pendingDocumentUpdate) return;
    if (requestedUpdateDocument !== 'license') return;
    updateDocumentAutoOpenedRef.current = true;
    setUpdateTarget({ kind: 'document', key: 'license', face: 0, label: 'Driver License' });
  }, [requestedUpdateDocument, vehicle]);

  if (!vehicle) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        <GlassHeader title="Vehicle Details" subtitle="Review vehicle information and documents" onBackPress={() => router.back()} />
        <View style={styles.emptyState}>
          <AppText style={[styles.emptyStateTitle, { color: colors.foreground }]}>Vehicle not found</AppText>
          <AppText style={[styles.emptyStateText, { color: colors.mutedForeground }]}>This vehicle is no longer available in your account.</AppText>
        </View>
      </View>
    );
  }

  const updateDraftDocumentFace = (key: keyof DriverVehicleDocumentSet, face: 0 | 1, uri: string) => {
    setDraftDocuments(current => {
      if (!current) return current;
      const next: DriverVehicleDocumentSet = {
        ...current,
        [key]: {
          ...current[key],
          faces: [current[key].faces[0], current[key].faces[1]],
        },
      };
      next[key].faces[face] = uri;
      return next;
    });
  };

  const updateDraftPhoto = (key: 'outside' | 'inside', uri: string) => {
    setDraftPhotos(current => current ? { ...current, [key]: uri } : current);
  };

  const updateDraftDocumentExpiry = (key: ExpiryDocumentKey, expiryDate?: string) => {
    setDraftDocuments(current => current ? {
      ...current,
      [key]: {
        ...current[key],
        expiryDate,
      },
    } : current);
  };

  const requiresExpiryDate = (key: keyof DriverVehicleDocumentSet): key is ExpiryDocumentKey =>
    key === 'license' || key === 'insurance' || key === 'authorization';

  const confirmReplacementExpiry = () => {
    if (!expiryTarget) return;
    const expiry = parseDateDdMmYyyy(replacementExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!expiry || expiry <= today) {
      setReplacementExpiryError('Select a future expiry date');
      return;
    }
    updateDraftDocumentExpiry(expiryTarget.key, replacementExpiryDate);
    setExpiryTarget(null);
    setReplacementExpiryDate('');
    setReplacementExpiryError(undefined);
  };

  const pickImageForUpdate = async (target: UpdateTarget, fromCamera: boolean) => {
    const requestPermission = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const launchPicker = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const { status } = await requestPermission();
    if (status !== 'granted') {
      Alert.alert('Permission required', fromCamera ? 'Please allow camera access.' : 'Please allow photo access.');
      return;
    }

    const result = await launchPicker({ mediaTypes: ['images'], quality: 0.88, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    if (!isValidImageAsset(result.assets[0])) {
      Alert.alert('Invalid image', 'Please choose a valid image.');
      return;
    }

    if (target.kind === 'document') {
      updateDraftDocumentFace(target.key, target.face, result.assets[0].uri);
      setHasUnsavedChanges(true);
      if (requiresExpiryDate(target.key)) {
        updateDraftDocumentExpiry(target.key, undefined);
        setReplacementExpiryDate('');
        setReplacementExpiryError(undefined);
        setExpiryTarget({ key: target.key, label: target.label });
      }
    } else {
      updateDraftPhoto(target.key, result.assets[0].uri);
      setHasUnsavedChanges(true);
    }
    setUpdateTarget(null);
  };

  const submitVehicleDocumentUpdate = async () => {
    if (!vehicle || !driverProfile || !draftDocuments || !draftPhotos) return;
    const missingExpiry = (['license', 'insurance', 'authorization'] as const).find(key => {
      const expiry = parseDateDdMmYyyy(draftDocuments[key].expiryDate ?? '');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return !expiry || expiry <= today;
    });
    if (missingExpiry) {
      Alert.alert('Expiry date required', 'Select a future expiry date for each replaced document.');
      return;
    }
    setSavingUpdate(true);
    const updatedVehicle = submitDriverVehicleDocumentUpdate(vehicle, {
      documents: draftDocuments,
      photos: draftPhotos,
      submittedAt: new Date().toISOString(),
    });
    const nextProfile = appendDriverVehicle(driverProfile, updatedVehicle);
    await saveDriverProfile(nextProfile);
    await submitVerificationVehicleDocumentUpdate({
      userId: user?.id ?? 'unknown-user',
      driverProfile,
      vehicle,
      sourceVehicleStatus: vehicle.status,
      documents: updatedVehicle.pendingDocumentUpdate!.documents,
      photos: updatedVehicle.pendingDocumentUpdate!.photos,
      submittedAt: updatedVehicle.pendingDocumentUpdate!.submittedAt,
    });
    setSavingUpdate(false);
    setUpdateTarget(null);
    Alert.alert('Submitted for review', 'Updated documents submitted for review. Your approved documents remain active until review completes.');
  };

  const reviewHistory = getDriverVehicleReviewHistory(vehicle);
  const timeline = getDriverVehicleTimeline(vehicle);
  const pendingDocumentUpdate = vehicle.pendingDocumentUpdate;
  const canReplaceDocuments = vehicle.status === 'approved' && !pendingDocumentUpdate;
  const licenseComplianceStatus = getLicenseComplianceStatus(vehicle.licenseExpiryDate);
  const insuranceComplianceStatus = getInsuranceComplianceStatus(vehicle.insuranceExpiryDate);
  const authorizationComplianceStatus = getAuthorizationComplianceStatus(vehicle.authorizationExpiryDate);
  const licenseComplianceMessage = getLicenseComplianceMessage(vehicle.licenseExpiryDate);
  const insuranceComplianceMessage = getInsuranceComplianceMessage(vehicle.insuranceExpiryDate);
  const authorizationComplianceMessage = getAuthorizationComplianceMessage(vehicle.authorizationExpiryDate);
  const documentCards = [
    { key: 'license', label: 'Driver License', record: draftDocuments?.license ?? vehicle.documents?.license, faces: 2, galleryStartIndex: 0 },
    { key: 'nationalId', label: 'National ID', record: draftDocuments?.nationalId ?? vehicle.documents?.nationalId, faces: 2, galleryStartIndex: 2 },
    { key: 'insurance', label: 'Insurance', record: draftDocuments?.insurance ?? vehicle.documents?.insurance, faces: 1, galleryStartIndex: 4 },
    { key: 'authorization', label: 'Authorization Certificate', record: draftDocuments?.authorization ?? vehicle.documents?.authorization, faces: 1, galleryStartIndex: 5 },
  ] as const;

  const photoCards = [
    { key: 'outside', label: 'Vehicle Outside Photo', uri: draftPhotos?.outside ?? vehicle.photos?.outside ?? null },
    { key: 'inside', label: 'Vehicle Inside Photo', uri: draftPhotos?.inside ?? vehicle.photos?.inside ?? null },
  ] as const;
  const galleryItems: GalleryImage[] = [
    ...documentCards.flatMap(card =>
      Array.from({ length: card.faces }, (_, index): GalleryImage => ({
        id: `document-${card.key}-${index}`,
        title: `${card.label} ${card.faces === 2 ? (index === 0 ? 'Front' : 'Back') : ''}`.trim(),
        uri: card.record?.faces[index] ?? null,
      })),
    ),
    ...photoCards.map(photo => ({
      id: `photo-${photo.key}`,
      title: photo.label,
      uri: photo.uri,
    })),
  ];

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="Vehicle Details"
        subtitle="Review vehicle information and documents"
        onBackPress={() => router.back()}
      />
      <GlassScrollView
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: semanticSpacing.cardPadding,
        }}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Information</AppText>
          <InfoRow label="Vehicle Type" value={VEHICLE_LABELS[vehicle.vehicleType]} />
          <InfoRow label="Brand" value={vehicle.brand ?? 'Not set'} />
          <InfoRow label="Model" value={vehicle.model ?? 'Not set'} />
          <InfoRow label="Manufacture Year" value={vehicle.manufactureYear?.toString() ?? 'Not set'} />
          <InfoRow label="Plate Number" value={vehicle.plateNumber} last />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Status</AppText>
          <StatusPanel colors={colors} vehicle={vehicle} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Compliance</AppText>
          <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Review the current validity of each compliance document.
          </AppText>
          <ComplianceRow
            colors={colors}
            label="Driver License"
            status={licenseComplianceStatus}
            message={licenseComplianceMessage}
          />
          <ComplianceRow
            colors={colors}
            label="Insurance"
            status={insuranceComplianceStatus}
            message={insuranceComplianceMessage}
          />
          <ComplianceRow
            colors={colors}
            label="Authorization"
            status={authorizationComplianceStatus}
            message={authorizationComplianceMessage}
          />
        </View>

        {pendingDocumentUpdate ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Document Update</AppText>
            <AppText style={[styles.updateBanner, { color: colors.warningHex }]}>Updated documents submitted for review</AppText>
            <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              The current approved documents remain active until this update is reviewed.
            </AppText>
            <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Submitted {pendingDocumentUpdate.submittedAt}
            </AppText>
          </View>
        ) : null}

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Documents</AppText>
          <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Tap any thumbnail to preview the full image.</AppText>
          {documentCards.map(card => (
            <DocumentBlock
              key={card.key}
              colors={colors}
              label={card.label}
              record={card.record}
              faces={card.faces}
              warningText={getDocumentExpiryWarning(card.label, card.record?.expiryDate)}
              galleryStartIndex={card.galleryStartIndex}
              onPreview={(index) => setPreviewTarget({ index })}
              onReplaceFace={canReplaceDocuments
                ? (face) => void pickImageForUpdate(
                    { kind: 'document', key: card.key, face, label: card.label },
                    true,
                  )
                : undefined}
            />
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Photos</AppText>
          {photoCards.map(photo => (
            <PhotoBlock
              key={photo.key}
              colors={colors}
              label={photo.label}
              uri={photo.uri}
              galleryIndex={photo.key === 'outside' ? 6 : 7}
              onPreview={(index) => setPreviewTarget({ index })}
              onReplace={canReplaceDocuments
                ? () => void pickImageForUpdate(
                    { kind: 'photo', key: photo.key, label: photo.label },
                    true,
                  )
                : undefined}
            />
          ))}
        </View>

        {canReplaceDocuments && hasUnsavedChanges ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Changes Ready</AppText>
            <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Submit the updated photos and document details for review.
            </AppText>
            <AppButton
              title="Resubmit Application"
              onPress={() => void submitVehicleDocumentUpdate()}
              size="md"
              fullWidth
              loading={savingUpdate}
              disabled={!draftDocuments || !draftPhotos || Boolean(expiryTarget)}
            />
          </View>
        ) : null}

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle History</AppText>
          <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            {reviewHistory.length > 0 ? 'Submission and review events for this vehicle.' : 'No review history available yet.'}
          </AppText>
          {timeline.length > 0 ? (
            <View style={styles.timeline}>
              {timeline.map((entry, index) => (
                <View key={entry.id} style={styles.timelineRow}>
                  <View style={styles.timelineMarkerColumn}>
                    <View style={[styles.timelineDot, { backgroundColor: entry.type === 'approved' ? colors.successHex : entry.type === 'rejected' ? colors.destructiveHex : entry.type === 'under_review' ? colors.warningHex : colors.primary }]} />
                    {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
                  </View>
                  <View style={styles.timelineCopy}>
                    <AppText style={[styles.timelineTitle, { color: colors.foreground }]}>{formatTimelineLabel(entry.type)}</AppText>
                    <AppText style={[styles.timelineMeta, { color: colors.mutedForeground }]}>{formatTimelineDetail(entry)}</AppText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {vehicle.status === 'rejected' ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Rejected</AppText>
            <AppText style={[styles.rejectionReason, { color: colors.destructive }]}>
              Reason: {vehicle.rejectionReason ?? 'No rejection reason provided.'}
            </AppText>
            <View style={styles.buttonRow}>
              <AppButton
                title="Update Application"
                onPress={() => router.push({ pathname: '/driver-add-vehicle', params: { sourceVehicleId: vehicle.id } })}
                size="md"
                fullWidth
              />
              <AppButton
                title="Contact Support"
                onPress={() => router.push('/help-support')}
                size="md"
                variant="secondary"
                fullWidth
              />
            </View>
          </View>
        ) : null}

      </GlassScrollView>

      <ImageGalleryPreview
        images={galleryItems}
        initialIndex={previewTarget?.index ?? 0}
        onClose={() => setPreviewTarget(null)}
        visible={Boolean(previewTarget)}
      />

      <Modal visible={Boolean(updateTarget)} transparent animationType="fade" onRequestClose={() => setUpdateTarget(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setUpdateTarget(null)} activeOpacity={1} />
          <View style={[styles.previewSheet, { backgroundColor: colors.card }]}>
            <View style={styles.previewHeader}>
              <AppText style={[styles.previewTitle, { color: colors.foreground }]} numberOfLines={1}>
                {updateTarget?.label ?? 'Update'}
              </AppText>
              <TouchableOpacity onPress={() => setUpdateTarget(null)} accessibilityLabel="Close update editor">
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              {updateTarget?.kind === 'photo'
                ? 'Replace the vehicle photo.'
                : updateTarget?.face === 0
                  ? 'Replace the front image.'
                  : 'Replace the back image.'}
            </AppText>
            <View style={styles.updateActions}>
              <AppButton
                title="Upload from Gallery"
                onPress={() => updateTarget ? void pickImageForUpdate(updateTarget, false) : undefined}
                variant="secondary"
                fullWidth
                size="md"
              />
              <AppButton
                title="Take Photo"
                onPress={() => updateTarget ? void pickImageForUpdate(updateTarget, true) : undefined}
                fullWidth
                size="md"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(expiryTarget)} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.previewOverlay}>
          <View style={[styles.previewSheet, { backgroundColor: colors.card }]}>
            <View style={styles.previewHeader}>
              <AppText style={[styles.previewTitle, { color: colors.foreground }]}>
                New Expiry Date
              </AppText>
            </View>
            <AppText style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Enter the expiry date shown on the new {expiryTarget?.label.toLowerCase()} photo.
            </AppText>
            <DatePickerField
              label="Expiry date"
              value={replacementExpiryDate}
              onChange={value => {
                setReplacementExpiryDate(value);
                setReplacementExpiryError(undefined);
              }}
              error={replacementExpiryError}
              placeholder="DD/MM/YYYY"
              minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
            />
            <AppButton
              title="Save Expiry Date"
              onPress={confirmReplacementExpiry}
              fullWidth
              size="md"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DocumentBlock({
  colors,
  faces,
  label,
  galleryStartIndex,
  onPreview,
  onReplaceFace,
  warningText,
  record,
}: {
  colors: ReturnType<typeof useColors>;
  faces: 1 | 2;
  galleryStartIndex: number;
  label: string;
  onPreview: (index: number) => void;
  onReplaceFace?: (face: 0 | 1) => void;
  warningText?: string | null;
  record?: DriverVehicleDocumentRecord;
}) {
  const statusLabel = record ? formatDocumentStatus(record.reviewStatus) : 'Missing';
  const statusColor = record ? getStatusColor(colors, record.reviewStatus) : colors.mutedForeground;
  const images = record?.faces ?? [null, null];
  const visibleFaces = faces === 2 ? images.slice(0, 2) : images.slice(0, 1);

  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.blockTitle, { color: colors.foreground }]}>{label}</AppText>
          <AppText style={[styles.blockStatus, { color: statusColor }]}>{statusLabel}</AppText>
        </View>
      </View>
      <View style={styles.documentFaces}>
        {visibleFaces.map((uri, index) => (
          <View key={`${label}-${index}`} style={styles.documentFaceRow}>
            <PreviewThumbnail
              accessibilityLabel={`${label} ${index === 0 ? 'front' : 'back'} preview`}
              imageTestID={`${label}-${index === 0 ? 'front' : 'back'}-image`}
              galleryIndex={galleryStartIndex + index}
              onPreview={onPreview}
              uri={uri}
              style={[styles.thumbnail, { backgroundColor: colors.muted }]}
              placeholderColor={colors.mutedForeground}
            />
            <AppText style={[styles.documentFaceLabel, { color: colors.mutedForeground }]}>
              {faces === 2 ? (index === 0 ? 'Front photo' : 'Back photo') : 'Document photo'}
            </AppText>
            {onReplaceFace ? (
              <ReplaceFaceButton
                colors={colors}
                onPress={() => onReplaceFace(index as 0 | 1)}
              />
            ) : null}
          </View>
        ))}
      </View>
      {warningText ? <AppText style={[styles.warningText, { color: colors.warningHex }]}>{warningText}</AppText> : null}
    </View>
  );
}

function ReplaceFaceButton({
  colors,
  onPress,
}: {
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.replaceFaceButton,
        {
          backgroundColor: colors.primaryHex + '0D',
          borderColor: colors.primaryHex + '35',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel="Replace photo"
    >
      <Feather name="camera" size={15} color={colors.primary} />
      <AppText style={[styles.replaceFaceButtonText, { color: colors.primary }]}>Replace</AppText>
    </TouchableOpacity>
  );
}

function PhotoBlock({
  colors,
  galleryIndex,
  label,
  onPreview,
  onReplace,
  uri,
}: {
  colors: ReturnType<typeof useColors>;
  galleryIndex: number;
  label: string;
  onPreview: (index: number) => void;
  onReplace?: () => void;
  uri: string | null;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.blockTitle, { color: colors.foreground }]}>{label}</AppText>
          <AppText style={[styles.blockStatus, { color: uri ? colors.successHex : colors.mutedForeground }]}>{uri ? 'Saved' : 'Missing'}</AppText>
        </View>
      </View>
      <View style={styles.documentFaceRow}>
        <PreviewThumbnail
          accessibilityLabel={`${label} preview`}
          imageTestID={`${label}-image`}
          galleryIndex={galleryIndex}
          onPreview={onPreview}
          uri={uri}
          style={[styles.thumbnailLarge, { backgroundColor: colors.muted }]}
          placeholderColor={colors.mutedForeground}
        />
        <AppText style={[styles.documentFaceLabel, { color: colors.mutedForeground }]}>Vehicle photo</AppText>
        {onReplace ? <ReplaceFaceButton colors={colors} onPress={onReplace} /> : null}
      </View>
    </View>
  );
}

function PreviewThumbnail({
  accessibilityLabel,
  imageTestID,
  galleryIndex,
  onPreview,
  placeholderColor,
  style,
  uri,
}: {
  accessibilityLabel: string;
  imageTestID: string;
  galleryIndex: number;
  onPreview: (index: number) => void;
  placeholderColor: string;
  style: object;
  uri: string | null;
}) {
  const openPreview = () => {
    onPreview(galleryIndex);
  };

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={openPreview}
      style={style}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnailImage} testID={imageTestID} resizeMode="cover" />
      ) : (
        <Feather name="image" size={icons.semantic.row} color={placeholderColor} />
      )}
    </TouchableOpacity>
  );
}

function StatusPanel({ colors, vehicle }: { colors: ReturnType<typeof useColors>; vehicle: NonNullable<ReturnType<typeof useVehicle>> }) {
  if (vehicle.status === 'approved') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.successHex, backgroundColor: colors.successHex + '12' }]}>
        <AppText style={[styles.statusBoxTitle, { color: colors.successHex }]}>Approved</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Approval date: {vehicle.approvedAt ?? vehicle.submittedAt ?? 'Not set'}</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Approved for rides</AppText>
      </View>
    );
  }

  if (vehicle.status === 'pending_review') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.warningHex, backgroundColor: colors.warningHex + '12' }]}>
        <AppText style={[styles.statusBoxTitle, { color: colors.warningHex }]}>Pending Review</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Submitted date: {vehicle.submittedAt ?? 'Not set'}</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Under Review</AppText>
      </View>
    );
  }

  if (vehicle.status === 'rejected') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.destructiveHex, backgroundColor: colors.destructiveHex + '12' }]}>
        <AppText style={[styles.statusBoxTitle, { color: colors.destructiveHex }]}>Rejected</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Rejected date: {vehicle.rejectedAt ?? vehicle.submittedAt ?? 'Not set'}</AppText>
        <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Reason: {vehicle.rejectionReason ?? 'No rejection reason provided.'}</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.statusBox, { borderColor: colors.mutedForeground, backgroundColor: colors.muted + '16' }]}>
      <AppText style={[styles.statusBoxTitle, { color: colors.mutedForeground }]}>Draft</AppText>
      <AppText style={[styles.statusBoxText, { color: colors.foreground }]}>Waiting for submission</AppText>
    </View>
  );
}

function ComplianceRow({
  colors,
  label,
  message,
  status,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  message: string | null;
  status: 'valid' | 'expiring_soon' | 'urgent' | 'expired';
}) {
  const statusColor =
    status === 'valid'
      ? colors.successHex
      : status === 'expiring_soon'
        ? colors.warningHex
        : status === 'urgent'
          ? colors.warningHex
          : colors.destructiveHex;

  return (
    <View style={styles.complianceRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={[styles.complianceLabel, { color: colors.foreground }]}>{label}</AppText>
        {message ? <AppText style={[styles.complianceMessage, { color: status === 'expired' ? colors.destructiveHex : colors.warningHex }]}>{message}</AppText> : null}
      </View>
      <View style={[styles.compliancePill, { borderColor: statusColor, backgroundColor: `${statusColor}14` }]}>
        <AppText style={[styles.compliancePillText, { color: statusColor }]}>{getComplianceStatusLabel(status)}</AppText>
      </View>
    </View>
  );
}

function InfoRow({ label, last = false, value }: { label: string; last?: boolean; value: string }) {
  const colors = useColors();
  return (
    <>
      <View style={styles.infoRow}>
        <AppText style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</AppText>
        <AppText style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</AppText>
      </View>
      {!last ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
    </>
  );
}

function getStatusColor(colors: ReturnType<typeof useColors>, status: 'verified' | 'pending_review' | 'rejected') {
  return status === 'verified'
    ? colors.successHex
    : status === 'pending_review'
      ? colors.warningHex
      : colors.destructiveHex;
}

function formatDocumentStatus(status: 'verified' | 'pending_review' | 'rejected') {
  return status === 'verified'
    ? 'Uploaded'
    : status === 'pending_review'
      ? 'Pending Review'
      : 'Rejected';
}

function formatTimelineLabel(type: 'submitted' | 'under_review' | 'documents_updated' | 'approved' | 'rejected') {
  return type === 'submitted'
    ? 'Submitted'
    : type === 'under_review'
      ? 'Under Review'
      : type === 'documents_updated'
        ? 'Documents Updated'
      : type === 'approved'
        ? 'Approved'
        : 'Rejected';
}

function formatTimelineDetail(entry: { type: 'submitted' | 'under_review' | 'documents_updated' | 'approved' | 'rejected'; at: string; reason?: string }) {
  if (entry.type === 'documents_updated') return `${entry.at} - Updated documents submitted for review`;
  if (entry.type === 'rejected' && entry.reason) return `${entry.at} - ${entry.reason}`;
  return entry.at;
}

function getDocumentExpiryWarning(label: string, expiryDate?: string) {
  if (!expiryDate) return null;
  const expiry = parseDateDdMmYyyy(expiryDate);
  if (!expiry) return null;
  const now = new Date();
  const normalizedLabel = label.replace(/\s+/g, ' ').trim();
  if (expiry < now) return `${normalizedLabel} expired`;
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);
  if (expiry <= soon) return `${normalizedLabel} expires soon`;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionCard: { borderRadius: 18, padding: spacing[14], gap: semanticSpacing.rowGap },
  sectionTitle: { ...typography.title,  },
  sectionSubtitle: { ...typography.caption, lineHeight: 17 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  complianceLabel: { ...typography.label,  },
  complianceMessage: { ...typography.tiny, lineHeight: 15, marginTop: spacing[2] },
  compliancePill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing[10], paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  compliancePillText: { ...typography.tiny,  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap },
  infoLabel: { flex: 1, ...typography.caption,  },
  infoValue: { ...typography.caption, flexShrink: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth },
  statusBox: { borderWidth: 1, borderRadius: radius.card, padding: semanticSpacing.rowGap, gap: spacing[4] },
  statusBoxTitle: { ...typography.bodySmall,  },
  statusBoxText: { ...typography.caption, lineHeight: 17 },
  block: { gap: semanticSpacing.inlineGap, paddingTop: spacing[4] },
  blockHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: semanticSpacing.inlineGap },
  blockTitle: { ...typography.label,  },
  blockStatus: { ...typography.tiny, marginTop: 2 },
  thumbnailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: semanticSpacing.inlineGap },
  thumbnail: { width: 66, height: 66, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailLarge: { width: 106, height: 84, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
  documentFaces: { gap: spacing[10] },
  documentFaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  documentFaceLabel: { flex: 1, ...typography.caption,  },
  replaceFaceButton: {
    minHeight: 42,
    paddingHorizontal: spacing[14],
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  replaceFaceButtonText: { ...typography.button },
  warningText: { ...typography.tiny, lineHeight: 16 },
  timeline: { gap: spacing[14] },
  timelineRow: { flexDirection: 'row', gap: semanticSpacing.rowGap },
  timelineMarkerColumn: { width: spacing[16], alignItems: 'center' },
  timelineDot: { width: spacing[10], height: spacing[10], borderRadius: 5, marginTop: spacing[4] },
  timelineLine: { flex: 1, width: 2, minHeight: 22, marginTop: 4, borderRadius: 1 },
  timelineCopy: { flex: 1, gap: 2 },
  timelineTitle: { ...typography.label,  },
  timelineMeta: { ...typography.tiny, lineHeight: 16 },
  rejectionReason: { ...typography.label, lineHeight: 18 },
  updateBanner: { ...typography.label,  },
  updateActions: { gap: spacing[10] },
  buttonRow: { gap: spacing[10] },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: icons.semantic.row },
  previewSheet: { borderRadius: radius['3xl'], padding: spacing[14], gap: spacing[14], maxHeight: '88%' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  previewTitle: { flex: 1, ...typography.title,  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: semanticSpacing.inlineGap, padding: semanticSpacing.sectionGap },
  emptyStateTitle: { ...typography.h3,  },
  emptyStateText: { ...typography.label, textAlign: 'center', lineHeight: 18 },
});
