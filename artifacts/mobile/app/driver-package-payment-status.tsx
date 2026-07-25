import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useColors } from '@/hooks/useColors';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import { getManualPaymentClaimPresentation } from '@/domains/package-payments';
import { useQuery } from '@tanstack/react-query';
import { getPurchaseHistory } from '@/services/driverPackages';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function providerLabel(provider: string) {
  return provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

// Only an in-flight claim is worth opening (to resubmit / see the live status);
// a terminal claim (approved/rejected/expired) is read-only history and must NOT
// route to the checkout screen — its locked offer is gone → "offer unavailable".
const ACTIONABLE_CLAIM_STATUSES = new Set(['submitted', 'pending_review', 'needs_clarification']);

export default function DriverPackagePaymentStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { claims, isLoading } = useManualPaymentClaimsQuery();
  // Automatic (MoMo RequestToPay) purchases — previously invisible here.
  const purchasesQuery = useQuery({
    queryKey: ['driver', 'package-purchases'],
    queryFn: getPurchaseHistory,
    staleTime: 15_000,
  });
  const purchases = purchasesQuery.data ?? [];

  const purchaseBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PAID') return { label: 'Payment confirmed', bg: colors.successHex + '18', text: colors.success };
    if (s === 'FAILED') return { label: 'Payment failed', bg: colors.destructiveHex + '18', text: colors.destructive };
    return { label: 'Awaiting payment', bg: colors.warningHex + '18', text: colors.warning };
  };

  const handleClaimPress = (claim: any) => {
    router.push({
      pathname: '/driver-package-payment',
      params: { offerId: claim.offerId, claimId: claim.id },
    });
  };

  const renderStatusBadge = (status: any) => {
    const presentation = getManualPaymentClaimPresentation(status);
    let bg: any = colors.muted;
    let text: any = colors.mutedForeground;

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
        {isLoading && purchasesQuery.isLoading ? (
          <View style={styles.centerCard}>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Loading payments...</Text>
          </View>
        ) : purchases.length === 0 && claims.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="list" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No payments yet</Text>
            <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
              Your package payments — automatic and manual — will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {/* Automatic MoMo purchases (read-only history) */}
            {purchases.map((p) => {
              const badge = purchaseBadge(p.status);
              return (
                <View
                  key={p.id}
                  style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.titleBlock}>
                      <Text style={[styles.packageName, { color: colors.foreground }]}>{p.packageName}</Text>
                      <Text style={[styles.claimId, { color: colors.mutedForeground }]}>ID: {p.id}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
                      <Text style={[styles.value, { color: colors.foreground }]}>{formatRwf(p.pricePaidRwf)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: colors.mutedForeground }]}>Provider</Text>
                      <Text style={[styles.value, { color: colors.foreground }]}>{p.provider ? providerLabel(p.provider) : 'Mobile Money'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={[styles.label, { color: colors.mutedForeground }]}>When</Text>
                      <Text style={[styles.value, { color: colors.foreground }]}>{new Date(p.createdAt).toLocaleString()}</Text>
                    </View>
                    {p.status.toUpperCase() === 'PAID' ? (
                      <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.mutedForeground }]}>Rides added</Text>
                        <Text style={[styles.value, { color: colors.foreground }]}>
                          {p.ridesGranted}{p.bonusRidesGranted > 0 ? ` +${p.bonusRidesGranted}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {/* Manual proof-based claims */}
            {claims.map((claim) => {
              const actionable = ACTIONABLE_CLAIM_STATUSES.has(claim.status);
              return (
              <TouchableOpacity
                key={claim.id}
                style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}
                onPress={actionable ? () => handleClaimPress(claim) : undefined}
                disabled={!actionable}
                activeOpacity={0.78}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleBlock}>
                    <Text style={[styles.packageName, { color: colors.foreground }]}>{claim.packageName}</Text>
                    <Text style={[styles.claimId, { color: colors.mutedForeground }]}>ID: {claim.displayClaimId}</Text>
                  </View>
                  {renderStatusBadge(claim.status)}
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
                {actionable ? (
                  <View style={styles.cardFooter}>
                    <Text style={[styles.footerText, { color: colors.primary }]}>View details</Text>
                    <Feather name="chevron-right" size={14} color={colors.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>
              );
            })}
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
