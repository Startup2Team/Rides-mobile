import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
}: {
  colors: ReturnType<typeof useColors>;
  rejectionSummary?: DriverApplicationRejectionSummary | null;
  rejectionReason?: string | null;
}) {
  if (!rejectionSummary && !rejectionReason) return null;

  const fields = rejectionSummary?.rejectedFields ?? [];
  const documents = rejectionSummary?.rejectedDocuments ?? [];
  const reviewedAt = rejectionSummary?.reviewedAt ? new Date(rejectionSummary.reviewedAt) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.destructiveHex + '12', borderColor: colors.destructiveHex + '28' }]}>
      <View style={styles.header}>
        <Feather name="alert-circle" size={18} color={colors.destructive} />
        <Text style={[styles.title, { color: colors.destructive }]}>Reviewer requested changes</Text>
      </View>
      <Text style={[styles.message, { color: colors.foreground }]}>
        {rejectionSummary?.reason ?? rejectionReason ?? 'Your application was rejected. Please review the items below and resubmit.'}
      </Text>
      {!!fields.length && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>Fields to update</Text>
          <View style={styles.chips}>
            {fields.map(field => (
              <View key={field} style={[styles.chip, { borderColor: colors.destructiveHex + '30', backgroundColor: colors.destructiveHex + '10' }]}>
                <Text style={[styles.chipText, { color: colors.destructive }]}>{FIELD_LABELS[field] ?? field}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {!!documents.length && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>Documents and photos to retake</Text>
          <View style={styles.chips}>
            {documents.map(document => (
              <View key={document} style={[styles.chip, { borderColor: colors.destructiveHex + '30', backgroundColor: colors.destructiveHex + '10' }]}>
                <Text style={[styles.chipText, { color: colors.destructive }]}>{DOCUMENT_LABELS[document] ?? document}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {reviewedAt && (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          Reviewed {reviewedAt.toLocaleDateString()}
          {rejectionSummary?.reviewedBy ? ` by ${rejectionSummary.reviewedBy}` : ''}
        </Text>
      )}
      {rejectionSummary?.submissionId ? (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>Submission ID: {rejectionSummary.submissionId}</Text>
      ) : null}
    </View>
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
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  message: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
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
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  meta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
});
