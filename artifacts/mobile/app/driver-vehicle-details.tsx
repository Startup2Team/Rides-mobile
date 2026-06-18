import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useAuth } from '@/context/AuthContext';
import { appendDriverVehicle, getDriverVehicleReviewHistory, getDriverVehicleTimeline, getVehicleById, submitDriverVehicleDocumentUpdate } from '@/domain/driverVehicles';
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
import { VEHICLE_LABELS, type DriverVehicleDocumentRecord, type DriverVehicleDocumentSet } from '@/types';
import { parseDateDdMmYyyy } from '@/utils/dateUtils';
import { isValidImageAsset } from '@/utils/documentValidation';

type PreviewTarget = { label: string; uri: string } | null;
type UpdateTarget =
  | { kind: 'document'; key: keyof DriverVehicleDocumentSet; face: 0 | 1; label: string }
  | { kind: 'photo'; key: 'outside' | 'inside'; label: string };

export default function DriverVehicleDetailsScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { driverProfile, user, saveDriverProfile } = useAuth();
  const params = useLocalSearchParams<{ vehicleId?: string; updateDocument?: string }>();
  const vehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : null;
  const requestedUpdateDocument = typeof params.updateDocument === 'string' ? params.updateDocument : null;
  const vehicle = getVehicleById(driverProfile, vehicleId);
  const [previewTarget, setPreviewTarget] = React.useState<PreviewTarget>(null);
  const [updateTarget, setUpdateTarget] = React.useState<UpdateTarget | null>(null);
  const [draftDocuments, setDraftDocuments] = React.useState<DriverVehicleDocumentSet | null>(null);
  const [draftPhotos, setDraftPhotos] = React.useState<{ outside: string | null; inside: string | null } | null>(null);
  const [savingUpdate, setSavingUpdate] = React.useState(false);
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
    updateDocumentAutoOpenedRef.current = false;
  }, [vehicle]);

  React.useEffect(() => {
    if (!vehicle || !requestedUpdateDocument || updateDocumentAutoOpenedRef.current) return;
    if (requestedUpdateDocument !== 'license') return;
    updateDocumentAutoOpenedRef.current = true;
    setUpdateTarget({ kind: 'document', key: 'license', face: 0, label: 'Driver License' });
  }, [requestedUpdateDocument, vehicle]);

  if (!vehicle) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        <GlassHeader title="Vehicle Details" subtitle="Review vehicle information and documents" onBackPress={() => router.back()} />
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>Vehicle not found</Text>
          <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>This vehicle is no longer available in your account.</Text>
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
    } else {
      updateDraftPhoto(target.key, result.assets[0].uri);
    }
    setUpdateTarget(null);
  };

  const submitVehicleDocumentUpdate = async () => {
    if (!vehicle || !driverProfile || !draftDocuments || !draftPhotos) return;
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
  const licenseComplianceStatus = getLicenseComplianceStatus(vehicle.licenseExpiryDate);
  const insuranceComplianceStatus = getInsuranceComplianceStatus(vehicle.insuranceExpiryDate);
  const authorizationComplianceStatus = getAuthorizationComplianceStatus(vehicle.authorizationExpiryDate);
  const licenseComplianceMessage = getLicenseComplianceMessage(vehicle.licenseExpiryDate);
  const insuranceComplianceMessage = getInsuranceComplianceMessage(vehicle.insuranceExpiryDate);
  const authorizationComplianceMessage = getAuthorizationComplianceMessage(vehicle.authorizationExpiryDate);
  const documentCards = [
    { key: 'license', label: 'Driver License', record: vehicle.documents?.license, faces: 2 },
    { key: 'nationalId', label: 'National ID', record: vehicle.documents?.nationalId, faces: 2 },
    { key: 'insurance', label: 'Insurance', record: vehicle.documents?.insurance, faces: 1 },
    { key: 'authorization', label: 'Authorization Certificate', record: vehicle.documents?.authorization, faces: 1 },
  ] as const;

  const photoCards = [
    { key: 'outside', label: 'Vehicle Outside Photo', uri: vehicle.photos?.outside ?? null },
    { key: 'inside', label: 'Vehicle Inside Photo', uri: vehicle.photos?.inside ?? null },
  ] as const;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="Vehicle Details"
        subtitle="Review vehicle information and documents"
        onBackPress={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
      >
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Information</Text>
          <InfoRow label="Vehicle Type" value={VEHICLE_LABELS[vehicle.vehicleType]} />
          <InfoRow label="Brand" value={vehicle.brand ?? 'Not set'} />
          <InfoRow label="Model" value={vehicle.model ?? 'Not set'} />
          <InfoRow label="Manufacture Year" value={vehicle.manufactureYear?.toString() ?? 'Not set'} />
          <InfoRow label="Plate Number" value={vehicle.plateNumber} last />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Status</Text>
          <StatusPanel colors={colors} vehicle={vehicle} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Compliance</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Review the current validity of each compliance document.
          </Text>
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Document Update</Text>
            <Text style={[styles.updateBanner, { color: colors.warningHex }]}>Updated documents submitted for review</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              The current approved documents remain active until this update is reviewed.
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Submitted {pendingDocumentUpdate.submittedAt}
            </Text>
          </View>
        ) : null}

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Documents</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Tap any thumbnail to preview the full image.</Text>
          {documentCards.map(card => (
            <DocumentBlock
              key={card.key}
              colors={colors}
              label={card.label}
              record={card.record}
              faces={card.faces}
              warningText={getDocumentExpiryWarning(card.label, card.record?.expiryDate)}
              onPreview={target => setPreviewTarget(target)}
              onReplaceFace={(face) => setUpdateTarget({ kind: 'document', key: card.key, face, label: card.label })}
            />
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Photos</Text>
          {photoCards.map(photo => (
            <PhotoBlock
              key={photo.key}
              colors={colors}
              label={photo.label}
              uri={photo.uri}
              onPreview={target => setPreviewTarget(target)}
              onReplace={() => setUpdateTarget({ kind: 'photo', key: photo.key, label: photo.label })}
            />
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle History</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            {reviewHistory.length > 0 ? 'Submission and review events for this vehicle.' : 'No review history available yet.'}
          </Text>
          {timeline.length > 0 ? (
            <View style={styles.timeline}>
              {timeline.map((entry, index) => (
                <View key={entry.id} style={styles.timelineRow}>
                  <View style={styles.timelineMarkerColumn}>
                    <View style={[styles.timelineDot, { backgroundColor: entry.type === 'approved' ? colors.successHex : entry.type === 'rejected' ? colors.destructiveHex : entry.type === 'under_review' ? colors.warningHex : colors.primary }]} />
                    {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={[styles.timelineTitle, { color: colors.foreground }]}>{formatTimelineLabel(entry.type)}</Text>
                    <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>{formatTimelineDetail(entry)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {vehicle.status === 'rejected' ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Rejected</Text>
            <Text style={[styles.rejectionReason, { color: colors.destructive }]}>
              Reason: {vehicle.rejectionReason ?? 'No rejection reason provided.'}
            </Text>
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

        {vehicle.status === 'approved' ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Document Actions</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Replace any document or vehicle photo. Current approved documents stay active until review completes.</Text>
            <AppButton
              title="Submit Updated Documents"
              onPress={() => void submitVehicleDocumentUpdate()}
              size="md"
              fullWidth
              loading={savingUpdate}
              disabled={!draftDocuments || !draftPhotos}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(previewTarget)} transparent animationType="fade" onRequestClose={() => setPreviewTarget(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreviewTarget(null)} activeOpacity={1} />
          <View style={[styles.previewSheet, { backgroundColor: colors.card }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]} numberOfLines={1}>
                {previewTarget?.label ?? 'Preview'}
              </Text>
              <TouchableOpacity onPress={() => setPreviewTarget(null)} accessibilityLabel="Close preview">
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            {previewTarget?.uri ? (
              <Image source={{ uri: previewTarget.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: colors.muted }]}>
                <Feather name="image" size={28} color={colors.mutedForeground} />
                <Text style={[styles.previewPlaceholderText, { color: colors.mutedForeground }]}>No image available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(updateTarget)} transparent animationType="fade" onRequestClose={() => setUpdateTarget(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setUpdateTarget(null)} activeOpacity={1} />
          <View style={[styles.previewSheet, { backgroundColor: colors.card }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]} numberOfLines={1}>
                {updateTarget?.label ?? 'Update'}
              </Text>
              <TouchableOpacity onPress={() => setUpdateTarget(null)} accessibilityLabel="Close update editor">
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              {updateTarget?.kind === 'photo'
                ? 'Replace the vehicle photo.'
                : updateTarget?.face === 0
                  ? 'Replace the front image.'
                  : 'Replace the back image.'}
            </Text>
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
    </View>
  );
}

function DocumentBlock({
  colors,
  faces,
  label,
  onPreview,
  onReplaceFace,
  warningText,
  record,
}: {
  colors: ReturnType<typeof useColors>;
  faces: 1 | 2;
  label: string;
  onPreview: (target: PreviewTarget) => void;
  onReplaceFace: (face: 0 | 1) => void;
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
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.blockStatus, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.thumbnailRow}>
        {visibleFaces.map((uri, index) => (
          <TouchableOpacity
            key={`${label}-${index}`}
            style={[styles.thumbnail, { backgroundColor: colors.muted }]}
            onPress={() => uri ? onPreview({ label: `${label} ${index === 0 ? 'Front' : 'Back'}`, uri }) : onPreview(null)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${index === 0 ? 'front' : 'back'} preview`}
          >
            {uri ? <Image source={{ uri }} style={styles.thumbnailImage} /> : <Feather name="image" size={18} color={colors.mutedForeground} />}
          </TouchableOpacity>
        ))}
        <View style={styles.documentActionStack}>
          <AppButton
            title={faces === 2 ? 'Replace Front' : 'Replace'}
            onPress={() => onReplaceFace(0)}
            variant="secondary"
            size="sm"
            compact
          />
          {faces === 2 ? (
            <AppButton
              title="Replace Back"
              onPress={() => onReplaceFace(1)}
              variant="secondary"
              size="sm"
              compact
            />
          ) : null}
        </View>
      </View>
      {warningText ? <Text style={[styles.warningText, { color: colors.warningHex }]}>{warningText}</Text> : null}
    </View>
  );
}

function PhotoBlock({
  colors,
  label,
  onPreview,
  onReplace,
  uri,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  onPreview: (target: PreviewTarget) => void;
  onReplace: () => void;
  uri: string | null;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.blockTitle, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.blockStatus, { color: uri ? colors.successHex : colors.mutedForeground }]}>{uri ? 'Saved' : 'Missing'}</Text>
        </View>
      </View>
      <View style={styles.thumbnailRow}>
        <TouchableOpacity
          style={[styles.thumbnailLarge, { backgroundColor: colors.muted }]}
          onPress={() => uri ? onPreview({ label, uri }) : onPreview(null)}
          accessibilityRole="button"
          accessibilityLabel={`${label} preview`}
        >
          {uri ? <Image source={{ uri }} style={styles.thumbnailImage} /> : <Feather name="image" size={18} color={colors.mutedForeground} />}
        </TouchableOpacity>
        <AppButton title="Replace" onPress={onReplace} variant="secondary" size="sm" compact />
      </View>
    </View>
  );
}

function StatusPanel({ colors, vehicle }: { colors: ReturnType<typeof useColors>; vehicle: NonNullable<ReturnType<typeof getVehicleById>> }) {
  if (vehicle.status === 'approved') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.successHex, backgroundColor: colors.successHex + '12' }]}>
        <Text style={[styles.statusBoxTitle, { color: colors.successHex }]}>Approved</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Approval date: {vehicle.approvedAt ?? vehicle.submittedAt ?? 'Not set'}</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Approved for rides</Text>
      </View>
    );
  }

  if (vehicle.status === 'pending_review') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.warningHex, backgroundColor: colors.warningHex + '12' }]}>
        <Text style={[styles.statusBoxTitle, { color: colors.warningHex }]}>Pending Review</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Submitted date: {vehicle.submittedAt ?? 'Not set'}</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Under Review</Text>
      </View>
    );
  }

  if (vehicle.status === 'rejected') {
    return (
      <View style={[styles.statusBox, { borderColor: colors.destructiveHex, backgroundColor: colors.destructiveHex + '12' }]}>
        <Text style={[styles.statusBoxTitle, { color: colors.destructiveHex }]}>Rejected</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Rejected date: {vehicle.rejectedAt ?? vehicle.submittedAt ?? 'Not set'}</Text>
        <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Reason: {vehicle.rejectionReason ?? 'No rejection reason provided.'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.statusBox, { borderColor: colors.mutedForeground, backgroundColor: colors.muted + '16' }]}>
      <Text style={[styles.statusBoxTitle, { color: colors.mutedForeground }]}>Draft</Text>
      <Text style={[styles.statusBoxText, { color: colors.foreground }]}>Waiting for submission</Text>
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
        <Text style={[styles.complianceLabel, { color: colors.foreground }]}>{label}</Text>
        {message ? <Text style={[styles.complianceMessage, { color: status === 'expired' ? colors.destructiveHex : colors.warningHex }]}>{message}</Text> : null}
      </View>
      <View style={[styles.compliancePill, { borderColor: statusColor, backgroundColor: `${statusColor}14` }]}>
        <Text style={[styles.compliancePillText, { color: statusColor }]}>{getComplianceStatusLabel(status)}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, last = false, value }: { label: string; last?: boolean; value: string }) {
  const colors = useColors();
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
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
  sectionCard: { borderRadius: 18, padding: 14, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  complianceLabel: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  complianceMessage: { fontSize: 11, fontFamily: 'Inter_500Medium', lineHeight: 15, marginTop: 2 },
  compliancePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  compliancePillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  infoValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold', flexShrink: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth },
  statusBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  statusBoxTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  statusBoxText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  block: { gap: 8, paddingTop: 4 },
  blockHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  blockTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  blockStatus: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  thumbnailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail: { width: 66, height: 66, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailLarge: { width: 106, height: 84, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
  documentActionStack: { gap: 6, justifyContent: 'center' },
  warningText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', lineHeight: 16 },
  timeline: { gap: 14 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineMarkerColumn: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, minHeight: 22, marginTop: 4, borderRadius: 1 },
  timelineCopy: { flex: 1, gap: 2 },
  timelineTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  timelineMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  rejectionReason: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  updateBanner: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  updateActions: { gap: 10 },
  buttonRow: { gap: 10 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 18 },
  previewSheet: { borderRadius: 20, padding: 14, gap: 14, maxHeight: '88%' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold' },
  previewImage: { width: '100%', aspectRatio: 0.78, borderRadius: 16, backgroundColor: '#000' },
  previewPlaceholder: { alignItems: 'center', justifyContent: 'center', aspectRatio: 0.78, borderRadius: 16, gap: 10 },
  previewPlaceholderText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyStateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyStateText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
});
