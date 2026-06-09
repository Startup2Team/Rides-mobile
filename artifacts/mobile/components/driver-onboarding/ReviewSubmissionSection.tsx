import React from 'react';
import { Image, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { DocFaces, DocumentKey, DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { VEHICLE_LABELS } from '@/types';
import { DOCUMENTS, PAYMENT_PROVIDER_LOGOS } from './onboardingData';
import { styles } from './onboardingStyles';

export function ReviewSubmissionSection({ colors, docs, form }: {
  colors: ReturnType<typeof useColors>;
  docs: Record<DocumentKey, DocFaces>;
  form: DriverOnboardingForm;
}) {
  const isDark = useColorScheme() === 'dark';
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const separatorColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const totalImages = Object.values(docs).reduce((n, faces) => n + faces.filter(Boolean).length, 0);
  const providerLabel = form.momoProvider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Review Your Application</Text>
      <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
        Take a moment to confirm everything looks correct before submitting.
      </Text>

      {/* Personal */}
      <ReviewCard icon="user" title="Personal Information" cardFill={cardFill}  colors={colors}>
        <ReviewRow label="National ID" value={form.nationalId} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Date of Birth" value={form.dob} separatorColor={separatorColor} colors={colors} />
        <ReviewRow
          label="Location"
          value={[form.province, form.district, form.sector].filter(Boolean).join(', ')}
          separatorColor={separatorColor}
          colors={colors}
        />
        <ReviewRow
          label="Cell / Village"
          value={[form.cell, form.village].filter(Boolean).join(', ')}
          separatorColor={separatorColor}
          colors={colors}
          last
        />
      </ReviewCard>

      {/* Vehicle */}
      <ReviewCard icon="truck" title="Vehicle Information" cardFill={cardFill} colors={colors}>
        <ReviewRow label="Vehicle Type" value={VEHICLE_LABELS[form.vehicleType]} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Plate Number" value={form.plateNumber} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Licence Number" value={form.licenseNumber} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Licence Expiry" value={form.licenseExpiryDate} separatorColor={separatorColor} colors={colors} last />
      </ReviewCard>

      {/* Documents */}
      <ReviewCard icon="file-text" title="Uploaded Documents" cardFill={cardFill} colors={colors}>
        {DOCUMENTS.map((doc, index) => {
          const front = docs[doc.key][0];
          const back = docs[doc.key][1];
          const count = [front, back].filter(Boolean).length;
          return (
            <View
              key={doc.key}
              style={[
                reviewStyles.docRow,
                index < DOCUMENTS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[reviewStyles.docName, { color: colors.foreground }]}>{doc.label}</Text>
                <Text style={[reviewStyles.docSub, { color: colors.mutedForeground }]}>
                  {count === 0 ? 'No images' : `${count} image${count > 1 ? 's' : ''} attached`}
                </Text>
              </View>
              {front ? (
                <View style={reviewStyles.thumbRow}>
                  <Image source={{ uri: front }} style={reviewStyles.thumb} resizeMode="cover" />
                  {back && <Image source={{ uri: back }} style={reviewStyles.thumb} resizeMode="cover" />}
                </View>
              ) : (
                <Feather name="alert-circle" size={16} color={colors.destructive} />
              )}
            </View>
          );
        })}
        <ReviewRow label="Total images" value={`${totalImages} attached`} separatorColor={separatorColor} colors={colors} last />
      </ReviewCard>

      {/* Payment */}
      <ReviewCard icon="credit-card" title="Mobile Money Details" cardFill={cardFill} colors={colors}>
        <View style={[reviewStyles.providerBadge, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor }]}>
          <Image source={PAYMENT_PROVIDER_LOGOS[form.momoProvider]} style={reviewStyles.providerLogo} resizeMode="contain" />
          <Text style={[reviewStyles.providerLabel, { color: colors.foreground }]}>{providerLabel}</Text>
          <Feather name="check-circle" size={16} color={colors.primary} />
        </View>
        {form.momoCode ? <ReviewRow label="Phone Number" value={form.momoCode} separatorColor={separatorColor} colors={colors} /> : null}
        {form.merchantCode ? <ReviewRow label="Merchant Code" value={form.merchantCode} separatorColor={separatorColor} colors={colors} last={!form.momoCode} /> : null}
        {!form.momoCode && !form.merchantCode && (
          <ReviewRow label="Mobile Money Details" value="Not provided" separatorColor={separatorColor} colors={colors} last />
        )}
      </ReviewCard>

      {/* What happens next */}
      <View style={[reviewStyles.notice, { backgroundColor: colors.primaryHex + '10', borderColor: colors.primaryHex + '25' }]}>
        <Feather name="info" size={16} color={colors.primary} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[reviewStyles.noticeTitle, { color: colors.primary }]}>What happens next?</Text>
          <Text style={[reviewStyles.noticeText, { color: colors.mutedForeground }]}>
            Our team will review your application as quickly as possible. You'll receive a notification once it's approved or if any corrections are needed. </Text>
        </View>
      </View>
    </View>
  );
}

function ReviewCard({ icon, title, cardFill, colors, children }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  cardFill: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={[reviewStyles.card, { backgroundColor: cardFill }]}>
      <View style={reviewStyles.cardHeader}>
        <Feather name={icon} size={16} color={colors.primary} />
        <Text style={[reviewStyles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <View style={[reviewStyles.cardDivider, { backgroundColor: colors.border }]} />
      {children}
    </View>
  );
}

function ReviewRow({ label, value, separatorColor, colors, last = false }: {
  label: string;
  value: string;
  separatorColor: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View style={[reviewStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor }]}>
      <Text style={[reviewStyles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[reviewStyles.rowValue, { color: colors.foreground }]} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginHorizontal: 0,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  cardDivider: {
    height: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
    gap: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    flexShrink: 0,
  },
  rowValue: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    flex: 1,
    textAlign: 'right',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
    gap: 12,
  },
  docName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  docSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 4,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 52,
  },
  providerLogo: {
    width: 40,
    height: 24,
  },
  providerLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  noticeTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  noticeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
