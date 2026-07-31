import React, { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useColors } from '@/hooks/useColors';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import {
  getManualPaymentClaimPresentation,
  isManualPaymentClaimExpired,
  type ManualPaymentClaimReadModel,
  type ManualPaymentClaimStatus,
} from '@/domains/package-payments';
import { reportOperationalFailure } from '@/observability/monitoring';

// Payment (claim) details for a single manual package payment. This is where
// "View details" on the Payment Status list lands: everything is rendered from
// the claim itself — NOT the 15-minute locked package offer, which is long gone
// for anything on a history screen.

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function providerLabel(provider: string) {
  return provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

function formatDateTime(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

// Expiry is applied lazily on read elsewhere (repository getManualPaymentClaim);
// the list endpoint returns stored statuses unmodified, so mirror the same
// policy here for display.
function effectiveStatus(claim: ManualPaymentClaimReadModel): ManualPaymentClaimStatus {
  return isManualPaymentClaimExpired({ status: claim.status, expiresAt: claim.expiresAt })
    ? 'expired'
    : claim.status;
}

function buildReceiptText(claim: ManualPaymentClaimReadModel) {
  const lines = [
    'Rides — Payment Receipt',
    '',
    `Package: ${claim.packageName}`,
    `Amount: ${formatRwf(claim.expectedAmountRwf)}`,
    `Provider: ${providerLabel(claim.provider)}`,
  ];
  if (claim.maskedPayerPhone) lines.push(`Paid from: ${claim.maskedPayerPhone}`);
  if (claim.maskedTransactionReference) lines.push(`Transaction ref: ${claim.maskedTransactionReference}`);
  const submitted = formatDateTime(claim.submittedAt ?? claim.createdAt);
  if (submitted) lines.push(`Submitted: ${submitted}`);
  const confirmed = formatDateTime(claim.approvedAt);
  if (confirmed) lines.push(`Confirmed: ${confirmed}`);
  lines.push(`Receipt ID: ${claim.displayClaimId}`);
  return lines.join('\n');
}

export default function DriverPackageClaimScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ claimId?: string }>();
  const claimId = typeof params.claimId === 'string' ? params.claimId : null;
  const { claims, isLoading } = useManualPaymentClaimsQuery();

  const claim = useMemo(
    () => claims.find(item => item.id === claimId) ?? null,
    [claims, claimId],
  );
  const status = claim ? effectiveStatus(claim) : null;
  const presentation = status ? getManualPaymentClaimPresentation(status) : null;

  const badgeColors = (tone: string) => {
    if (tone === 'success') return { bg: colors.successHex + '18', text: colors.success };
    if (tone === 'warning') return { bg: colors.warningHex + '18', text: colors.warning };
    if (tone === 'danger') return { bg: colors.destructiveHex + '18', text: colors.destructive };
    if (tone === 'info') return { bg: colors.primaryHex + '18', text: colors.primary };
    return { bg: colors.muted, text: colors.mutedForeground };
  };

  const handleShareReceipt = async () => {
    if (!claim) return;
    try {
      await Share.share(
        { message: buildReceiptText(claim), title: 'Rides payment receipt' },
        { dialogTitle: 'Share receipt' },
      );
    } catch (error) {
      reportOperationalFailure('package-payment.receipt.share', error, { claimId: claim.id });
    }
  };

  const cardBackground = isDark ? '#1C1C1E' : '#FFFFFF';

  const renderRow = (label: string, value: string | null) => {
    if (!value) return null;
    return (
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Payment Details" onBackPress={() => router.back()} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
      >
        {isLoading ? (
          <View style={styles.centerCard}>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Loading payment...</Text>
          </View>
        ) : !claim || !status || !presentation ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBackground, borderColor: colors.border }]}>
            <Feather name="file-text" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Payment not found</Text>
            <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
              This payment confirmation is no longer available on this device.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.primaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            <View style={[styles.card, { backgroundColor: cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.titleBlock}>
                  <Text style={[styles.packageName, { color: colors.foreground }]}>{claim.packageName}</Text>
                  <Text style={[styles.claimId, { color: colors.mutedForeground }]}>ID: {claim.displayClaimId}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badgeColors(presentation.tone).bg }]}>
                  <Text style={[styles.badgeText, { color: badgeColors(presentation.tone).text }]}>
                    {presentation.title}
                  </Text>
                </View>
              </View>

              <Text style={[styles.statusMessage, { color: colors.mutedForeground }]}>
                {presentation.message}
              </Text>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.cardBody}>
                {renderRow('Amount', formatRwf(claim.expectedAmountRwf))}
                {renderRow('Provider', providerLabel(claim.provider))}
                {renderRow('Paid from', claim.maskedPayerPhone ?? null)}
                {renderRow('Transaction ref', claim.maskedTransactionReference ?? null)}
                {renderRow('Submitted', formatDateTime(claim.submittedAt ?? claim.createdAt))}
                {renderRow('Confirmed', formatDateTime(claim.approvedAt))}
              </View>

              {claim.clarificationMessage ? (
                <Text style={[styles.noteText, { color: colors.warning }]}>{claim.clarificationMessage}</Text>
              ) : null}
            </View>

            {status === 'approved' ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleShareReceipt}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Share receipt"
                accessibilityHint="Opens the share sheet with this payment receipt"
              >
                <Feather name="share" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Share receipt</Text>
              </TouchableOpacity>
            ) : null}

            {status === 'expired' || status === 'rejected' ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: cardBackground }]}
                onPress={() => router.push('/driver-packages')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Choose a package"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Choose a package</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 14, paddingTop: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: { flex: 1, gap: 2 },
  packageName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  claimId: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  statusMessage: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth },
  cardBody: { gap: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noteText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  centerCard: { padding: 40, alignItems: 'center' },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
});
