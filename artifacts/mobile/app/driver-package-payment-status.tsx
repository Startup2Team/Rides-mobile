import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { PaymentReceiptSheet } from '@/components/driver/PaymentReceiptSheet';
import { SegmentedFilter } from '@/components/driver/SegmentedFilter';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import {
  buildClaimReceipt,
  buildPurchaseReceipt,
  getManualPaymentClaimPresentation,
  type PaymentReceipt,
} from '@/domains/package-payments';
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

/** Outcome buckets the filter chips work on, across both payment kinds. */
type Outcome = 'confirmed' | 'pending' | 'failed';

const FILTERS: { id: 'all' | Outcome; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
];

function purchaseOutcome(status: string): Outcome {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'confirmed';
  if (s === 'FAILED') return 'failed';
  return 'pending';
}

function claimOutcome(status: string): Outcome {
  const s = status.toLowerCase();
  if (s === 'approved') return 'confirmed';
  if (s === 'rejected' || s === 'expired') return 'failed';
  return 'pending';
}

/** One row in the unified payment history — automatic purchase or manual claim. */
interface PaymentRow {
  key: string;
  kind: 'purchase' | 'claim';
  outcome: Outcome;
  title: string;
  displayId: string;
  amountRwf: number;
  providerText: string;
  whenLabel: string;
  whenIso: string;
  ridesText: string | null;
  /** Non-null only for a settled payment. */
  receipt: PaymentReceipt | null;
  /** Manual claims that can still be opened for resubmission. */
  claim: { offerId: string; id: string } | null;
  /** Raw claim status, for the manual-claim badge presentation. */
  claimStatus: string | null;
  /** Lowercased haystack for the search box. */
  haystack: string;
}

export default function DriverPackagePaymentStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const { claims, isLoading } = useManualPaymentClaimsQuery();
  // Automatic (MoMo RequestToPay) purchases — previously invisible here.
  const purchasesQuery = useQuery({
    queryKey: ['driver', 'package-purchases'],
    queryFn: getPurchaseHistory,
    staleTime: 15_000,
  });
  const purchases = purchasesQuery.data ?? [];

  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | Outcome>('all');
  const [receipt, setReceipt] = React.useState<PaymentReceipt | null>(null);

  const holder = React.useMemo(
    () => ({ name: user?.name ?? null, phone: user?.phone ?? null }),
    [user?.name, user?.phone],
  );

  const rows = React.useMemo<PaymentRow[]>(() => {
    const fromPurchases: PaymentRow[] = purchases.map(p => {
      const outcome = purchaseOutcome(p.status);
      const providerText = p.provider ? providerLabel(p.provider) : 'Mobile Money';
      return {
        key: `purchase:${p.id}`,
        kind: 'purchase',
        outcome,
        title: p.packageName,
        displayId: p.id,
        amountRwf: p.pricePaidRwf,
        providerText,
        whenLabel: new Date(p.createdAt).toLocaleString(),
        whenIso: p.createdAt,
        ridesText:
          outcome === 'confirmed'
            ? `${p.ridesGranted}${p.bonusRidesGranted > 0 ? ` +${p.bonusRidesGranted}` : ''}`
            : null,
        receipt: buildPurchaseReceipt(p, holder),
        claim: null,
        claimStatus: null,
        haystack: [p.packageName, p.id, providerText, String(p.pricePaidRwf)].join(' ').toLowerCase(),
      };
    });

    const fromClaims: PaymentRow[] = claims.map(claim => {
      const providerText = providerLabel(claim.provider);
      return {
        key: `claim:${claim.id}`,
        kind: 'claim',
        outcome: claimOutcome(claim.status),
        title: claim.packageName,
        displayId: claim.displayClaimId,
        amountRwf: claim.expectedAmountRwf,
        providerText,
        whenLabel: new Date(claim.submittedAt ?? claim.createdAt).toLocaleString(),
        whenIso: claim.submittedAt ?? claim.createdAt,
        ridesText: null,
        receipt: buildClaimReceipt(claim, holder),
        claim: ACTIONABLE_CLAIM_STATUSES.has(claim.status)
          ? { offerId: claim.offerId, id: claim.id }
          : null,
        claimStatus: claim.status,
        haystack: [claim.packageName, claim.displayClaimId, providerText, String(claim.expectedAmountRwf)]
          .join(' ')
          .toLowerCase(),
      };
    });

    return [...fromPurchases, ...fromClaims].sort(
      (a, b) => new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime(),
    );
  }, [claims, holder, purchases]);

  const visibleRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(row => {
      if (filter !== 'all' && row.outcome !== filter) return false;
      if (!needle) return true;
      return row.haystack.includes(needle);
    });
  }, [filter, query, rows]);

  const counts = React.useMemo(
    () => ({
      all: rows.length,
      confirmed: rows.filter(r => r.outcome === 'confirmed').length,
      pending: rows.filter(r => r.outcome === 'pending').length,
      failed: rows.filter(r => r.outcome === 'failed').length,
    }),
    [rows],
  );

  const loading = isLoading && purchasesQuery.isLoading;
  const hasAnyPayment = rows.length > 0;

  const purchaseBadge = (outcome: Outcome) => {
    if (outcome === 'confirmed') {
      return { label: 'Payment confirmed', bg: colors.successHex + '18', text: colors.success };
    }
    if (outcome === 'failed') {
      return { label: 'Payment failed', bg: colors.destructiveHex + '18', text: colors.destructive };
    }
    return { label: 'Awaiting payment', bg: colors.warningHex + '18', text: colors.warning };
  };

  const handleClaimPress = (claim: { offerId: string; id: string }) => {
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

  const renderRow = ({ item }: { item: PaymentRow }) => {
    const openable = Boolean(item.claim);
    const badge = purchaseBadge(item.outcome);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}
        onPress={openable ? () => handleClaimPress(item.claim!) : undefined}
        disabled={!openable}
        activeOpacity={0.78}
        accessibilityRole={openable ? 'button' : undefined}
        accessibilityLabel={`${item.title}, ${formatRwf(item.amountRwf)}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={[styles.packageName, { color: colors.foreground }]}>{item.title}</Text>
            <Text style={[styles.claimId, { color: colors.mutedForeground }]}>ID: {item.displayId}</Text>
          </View>
          {item.kind === 'purchase' ? (
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          ) : (
            renderStatusBadge(item.claimStatus)
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{formatRwf(item.amountRwf)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Provider</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{item.providerText}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {item.kind === 'purchase' ? 'When' : 'Submitted'}
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{item.whenLabel}</Text>
          </View>
          {item.ridesText ? (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Rides added</Text>
              <Text style={[styles.value, { color: colors.foreground }]}>{item.ridesText}</Text>
            </View>
          ) : null}
        </View>

        {item.receipt || openable ? (
          <View style={styles.cardFooter}>
            {item.receipt ? (
              <TouchableOpacity
                style={[styles.receiptButton, { borderColor: colors.border }]}
                onPress={() => setReceipt(item.receipt)}
                accessibilityRole="button"
                accessibilityLabel={`View receipt for ${item.title}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.78}
              >
                <Feather name="file-text" size={13} color={colors.primary} />
                <Text style={[styles.receiptButtonText, { color: colors.primary }]}>Receipt</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            {openable ? (
              <View style={styles.footerLink}>
                <Text style={[styles.footerText, { color: colors.primary }]}>View details</Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const listHeader = hasAnyPayment ? (
    <View style={styles.controls}>
      {/* Recessed search field, iOS style — no border competing with the cards. */}
      <View
        style={[
          styles.searchField,
          { backgroundColor: isDark ? '#1C1C1E' : 'rgba(120,120,128,0.12)' },
        ]}
      >
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search package, ID or amount"
          placeholderTextColor={colors.mutedForeground as any}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search payments"
        />
      </View>

      <SegmentedFilter
        options={FILTERS.map(f => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Filter payments by outcome"
      />
    </View>
  ) : null;

  const listEmpty = loading ? (
    <View style={styles.centerCard}>
      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Loading payments...</Text>
    </View>
  ) : hasAnyPayment ? (
    // Something exists, just nothing matching the current search/filter.
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Feather name="search" size={24} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matching payments</Text>
      <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
        Try a different search term or clear the filter.
      </Text>
    </View>
  ) : (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Feather name="list" size={24} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No payments yet</Text>
      <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
        Your package payments — automatic and manual — will appear here.
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Payment Status" onBackPress={() => router.back()} />
      <FlatList
        data={visibleRows}
        keyExtractor={item => item.key}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={styles.root}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <PaymentReceiptSheet receipt={receipt} onClose={() => setReceipt(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 10, gap: 10, paddingBottom: 4 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', padding: 0 },
  separator: { height: 14 },
  card: {
    marginHorizontal: 16,
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
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  receiptButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
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
