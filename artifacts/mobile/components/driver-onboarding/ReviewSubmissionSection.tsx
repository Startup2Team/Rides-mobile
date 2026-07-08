import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { Image, Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { VEHICLE_LABELS } from '@/types';
import type { GalleryImage } from '@/components/ImageGalleryPreview';
import { PAYMENT_PROVIDER_LOGOS } from './onboardingData';
import { styles } from './onboardingStyles';

export function ReviewSubmissionSection({ colors, form, onOpenImagePreview, previewImages }: {
  colors: ReturnType<typeof useColors>;
  form: DriverOnboardingForm;
  onOpenImagePreview: (index: number) => void;
  previewImages: GalleryImage[];
}) {
  const isDark = useColorScheme() === 'dark';
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const separatorColor = isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)';
  const providerLabel = form.momoProvider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';

  return (
    <View style={styles.section}>
      <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Review Your Application</AppText>
      <AppText style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
        Take a moment to confirm everything looks correct before submitting.
      </AppText>

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
        <ReviewRow label="Brand" value={form.brand} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Model" value={form.model} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Manufacture Year" value={form.manufactureYear} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Plate Number" value={form.plateNumber} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Licence Number" value={form.licenseNumber} separatorColor={separatorColor} colors={colors} />
        <ReviewRow label="Licence Expiry" value={form.licenseExpiryDate} separatorColor={separatorColor} colors={colors} last />
      </ReviewCard>

      {/* Documents */}
      <ReviewCard icon="file-text" title="Submitted Images" cardFill={cardFill} colors={colors}>
        {previewImages.length ? previewImages.map((image, index) => (
          <TouchableOpacity
            key={image.id}
            accessibilityLabel={`Preview ${image.title ?? 'submitted image'}`}
            onPress={() => onOpenImagePreview(index)}
            style={[
              reviewStyles.imageRow,
              index < previewImages.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText style={[reviewStyles.docName, { color: colors.foreground }]}>{image.title ?? 'Submitted image'}</AppText>
              <AppText style={[reviewStyles.docSub, { color: colors.mutedForeground }]}>
                {image.subtitle ?? 'Tap to preview'}
              </AppText>
            </View>
            <Image source={{ uri: image.uri ?? undefined }} style={reviewStyles.thumb} resizeMode="cover" />
          </TouchableOpacity>
        )) : (
          <View style={reviewStyles.emptyState}>
            <Feather name="image" size={16} color={colors.mutedForeground} />
            <AppText style={[reviewStyles.docSub, { color: colors.mutedForeground }]}>No images attached</AppText>
          </View>
        )}
        <ReviewRow label="Total images" value={`${previewImages.length} attached`} separatorColor={separatorColor} colors={colors} last />
      </ReviewCard>

      {/* Payment */}
      <ReviewCard icon="credit-card" title="Mobile Money Details" cardFill={cardFill} colors={colors}>
        <View style={[reviewStyles.providerBadge, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor }]}>
          <Image source={PAYMENT_PROVIDER_LOGOS[form.momoProvider]} style={reviewStyles.providerLogo} resizeMode="contain" />
          <AppText style={[reviewStyles.providerLabel, { color: colors.foreground }]}>{providerLabel}</AppText>
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
          <AppText style={[reviewStyles.noticeTitle, { color: colors.primary }]}>What happens next?</AppText>
          <AppText style={[reviewStyles.noticeText, { color: colors.mutedForeground }]}>
            Our team will review your application as quickly as possible. You'll receive a notification once it's approved or if any corrections are needed. </AppText>
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
        <AppText style={[reviewStyles.cardTitle, { color: colors.foreground }]}>{title}</AppText>
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
      <AppText style={[reviewStyles.rowLabel, { color: colors.mutedForeground }]}>{label}</AppText>
      <AppText style={[reviewStyles.rowValue, { color: colors.foreground }]} numberOfLines={2}>{value || '—'}</AppText>
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
    ...typography.bodySmall,
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
    ...typography.body,
    flexShrink: 0,
  },
  rowValue: {
    ...typography.body,
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
    ...typography.body,
  },
  docSub: {
    ...typography.caption,
    marginTop: 2,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 64,
    gap: 12,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    ...typography.label,
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
    ...typography.label,
  },
  noticeText: {
    ...typography.caption,
    lineHeight: 18,
  },
});
