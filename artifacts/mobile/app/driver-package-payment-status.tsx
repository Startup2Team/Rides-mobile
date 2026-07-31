import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme, type ColorValue } from 'react-native';
import { router } from 'expo-router';
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

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function providerLabel(provider: string) {
  return provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

export default function DriverPackagePaymentStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { claims, isLoading } = useManualPaymentClaimsQuery();

  // Claim details render from the claim itself. Routing through
  // /driver-package-payment is wrong here: that screen resolves the 15-minute
  // locked OFFER (already gone for anything on a history list), and the read
  // model doesn't even carry offerId — every tap dead-ended on
  // "Package offer unavailable".
  const handleClaimPress = (claim: ManualPaymentClaimReadModel) => {
    router.push({
      pathname: '/driver-package-claim',
      params: { claimId: claim.id },
    });
  };

  const renderStatusBadge = (status: ManualPaymentClaimStatus) => {
    const presentation = getManualPaymentClaimPresentation(status);
    let bg: ColorValue = colors.muted;
    let text: ColorValue = colors.mutedForeground;

    if (presentation.tone === 'success') {
      bg = colors.successHex + '18';
      text = colors.success;
    } else if (presentation.tone === 'warning') {
      bg = colors.warningHex + '18';
      text = colors.warning;
    } else if (presentation.tone === 'danger') {
      bg = colors.destructiveHex + '18';
      text = colors.destructive;
    } else if (presentation.tone === 'info') {
      bg = colors.primaryHex + '18';
      text = colors.primary;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{presentation.title}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="Payment Status"
        onBackPress={() => router.back()}
      />
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
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Loading confirmations...</Text>
          </View>
        ) : claims.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="list" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No payment confirmations yet</Text>
            <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
              Your manual package payment confirmations will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {claims.map((claim) => (
              <TouchableOpacity
                key={claim.id}
                style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}
                onPress={() => handleClaimPress(claim)}
                activeOpacity={0.78}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleBlock}>
                    <Text style={[styles.packageName, { color: colors.foreground }]}>{claim.packageName}</Text>
                    <Text style={[styles.claimId, { color: colors.mutedForeground }]}>ID: {claim.displayClaimId}</Text>
                  </View>
                  {/* Expiry is applied lazily on read elsewhere; mirror it so a
                      claim that lapsed since storage shows the right chip. */}
                  {renderStatusBadge(
                    isManualPaymentClaimExpired({ status: claim.status, expiresAt: claim.expiresAt })
                      ? 'expired'
                      : claim.status,
                  )}
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.cardBody}>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
                    <Text style={[styles.value, { color: colors.foreground }]}>{formatRwf(claim.expectedAmountRwf)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Provider</Text>
                    <Text style={[styles.value, { color: colors.foreground }]}>{providerLabel(claim.provider)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Submitted</Text>
                    <Text style={[styles.value, { color: colors.foreground }]}>
                      {new Date(claim.submittedAt ?? claim.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.footerText, { color: colors.primary }]}>View details</Text>
                  <Feather name="chevron-right" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  footerText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
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
