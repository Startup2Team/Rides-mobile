import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { DriverApplicationRejectionSummary } from '@/domain/verificationSubmissions';

const FIELD_LABELS: Record<string, string> = {
  brand: 'Brand',
  model: 'Model',
  manufactureYear: 'Manufacture year',
  plateNumber: 'Plate number',
  licenseNumber: 'Licence number',
  nationalId: 'National ID',
  dob: 'Date of birth',
  province: 'Province',
  district: 'District',
  sector: 'Sector',
  cell: 'Cell',
  village: 'Village',
  momoCode: 'Phone number',
  merchantCode: 'Merchant code',
  licenseExpiryDate: 'Licence expiry',
  insuranceExpiryDate: 'Insurance expiry',
  authorizationExpiryDate: 'Authorization expiry',
  passengerSeats: 'Passenger seats',
  loadCapacityKg: 'Load capacity',
};

const DOCUMENT_LABELS: Record<string, string> = {
  license: "Driver's licence",
  nationalId: 'National ID',
  insurance: 'Insurance',
  authorization: 'Authorization',
  vehicleOutsidePhoto: 'Vehicle outside photo',
  vehicleInsidePhoto: 'Vehicle inside photo',
};

export function DriverApplicationRejectionBanner({
  colors,
  rejectionSummary,
  rejectionReason,
  onPress,
}: {
  colors: ReturnType<typeof useColors>;
  rejectionSummary?: DriverApplicationRejectionSummary | null;
  rejectionReason?: string | null;
  onPress?: () => void;
}) {
  if (!rejectionSummary && !rejectionReason) return null;

  const fields = rejectionSummary?.rejectedFields ?? [];
  const documents = rejectionSummary?.rejectedDocuments ?? [];
  const reviewedAt = rejectionSummary?.reviewedAt ? new Date(rejectionSummary.reviewedAt) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: colors.destructiveHex + '12', borderColor: colors.destructiveHex + '28' }]}
    >
      <View style={styles.header}>
        <Feather name="alert-circle" size={18} color={colors.destructive} />
        <AppText style={[styles.title, { color: colors.destructive }]}>Reviewer requested changes</AppText>
      </View>
      <AppText style={[styles.message, { color: colors.foreground }]}>
        {rejectionSummary?.reason ?? rejectionReason ?? 'Your application requires updates. Please review the requested items below.'}
      </AppText>
      {!!fields.length && (
        <View style={styles.group}>
          <AppText style={[styles.groupTitle, { color: colors.mutedForeground }]}>Fields to update</AppText>
          <View style={styles.chips}>
            {fields.map(field => (
              <View key={field} style={[styles.chip, { borderColor: colors.destructiveHex + '30', backgroundColor: colors.destructiveHex + '10' }]}>
                <AppText style={[styles.chipText, { color: colors.destructive }]}>{FIELD_LABELS[field] ?? field}</AppText>
              </View>
            ))}
          </View>
        </View>
      )}
      {!!documents.length && (
        <View style={styles.group}>
          <AppText style={[styles.groupTitle, { color: colors.mutedForeground }]}>Documents and photos to retake</AppText>
          <View style={styles.chips}>
            {documents.map(document => (
              <View key={document} style={[styles.chip, { borderColor: colors.destructiveHex + '30', backgroundColor: colors.destructiveHex + '10' }]}>
                <AppText style={[styles.chipText, { color: colors.destructive }]}>{DOCUMENT_LABELS[document] ?? document}</AppText>
              </View>
            ))}
          </View>
        </View>
      )}
      {reviewedAt && (
        <AppText style={[styles.meta, { color: colors.mutedForeground }]}>
          Reviewed {reviewedAt.toLocaleDateString()}
          {rejectionSummary?.reviewedBy ? ` by ${rejectionSummary.reviewedBy}` : ''}
        </AppText>
      )}
      {rejectionSummary?.submissionId ? (
        <AppText style={[styles.meta, { color: colors.mutedForeground }]}>Submission ID: {rejectionSummary.submissionId}</AppText>
      ) : null}

      {onPress && (
        <View style={[styles.actionRow, { backgroundColor: colors.destructiveHex + '18' }]}>
          <AppText style={[styles.actionText, { color: colors.destructive }]}>Tap here to update requested items ➔</AppText>
          <Feather name="arrow-right" size={16} color={colors.destructive} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.body,
  },
  message: {
    ...typography.label,
    lineHeight: 19,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    ...typography.caption,
  },
  meta: {
    ...typography.tiny,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
