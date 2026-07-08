import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  getPackagePurchaseSnapshot,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
} from '@/domain/driverRidePackages';
import { formatRwf, getDriverActivitySummary } from '@/domain/driverActivitySummary';
import { formatDriverRatingSummary, getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import { elevation } from '@/constants/elevation';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { useRideHistoryQuery } from '@/query/hooks/useRideHistoryQuery';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverStats() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const statsContentTop = Math.max(0, headerMetrics.contentTop - spacing[20]);
  const { user, driverProfile } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const { data: rideHistory = [], refetch: refetchRideHistory } = useRideHistoryQuery(user?.id);
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await refetchRideHistory();
      const storedRatings = await loadStoredDriverRatings();
      const summary = user?.id ? getDriverRatingSummary(storedRatings.data ?? [], user.id) : EMPTY_RATING_SUMMARY;
      setRatingSummary(summary);
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [refetchRideHistory, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadRatingSummary() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id ? getDriverRatingSummary(stored.data ?? [], user.id) : EMPTY_RATING_SUMMARY;
      if (!cancelled) setRatingSummary(summary);
    }
    void loadRatingSummary();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dp = driverProfile ?? {
    dailyRides: 0,
    completedRides: 0,
    acceptanceRate: 0,
    dailyDeclines: 0,
    earningsTotal: 0,
  };
  const declinesToday = dp.dailyDeclines ?? 0;
  const dailyDecisionCount = dp.dailyRides + declinesToday;
  const acceptanceRateValue = dailyDecisionCount > 0 ? `${dp.acceptanceRate}%` : 'No data yet';
  const acceptanceRateNote = dailyDecisionCount > 0 ? 'Today' : 'No data yet';
  const activitySummary = getDriverActivitySummary({ driverId: user?.id, driverProfile, entitlement, rideHistory });
  const paymentTarget = driverProfile?.momoCode || driverProfile?.merchantCode || 'Not set';
  const priorityReduced = declinesToday >= 10;
  const ratingValue = formatDriverRatingSummary(ratingSummary);
  const hasTripsToday = activitySummary.completedRidesToday > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        title="Statistics"
        showBack={false}
      />
      <GlassScrollView
        style={styles.container}
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: Platform.OS === 'ios' ? 0 : statsContentTop,
          paddingBottom: insets.bottom + TAB_BAR_SCREEN_BOTTOM_PADDING,
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: semanticSpacing.sectionGap,
        }}
        contentInset={Platform.OS === 'ios' ? { top: statsContentTop } : undefined}
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: -statsContentTop } : undefined}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        <LinearGradient
          colors={[colors.primaryHex, colors.primaryHex + 'D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, styles.heroShadow]}
        >
          <View style={styles.heroHeading}>
            <AppText style={styles.heroEyebrow}>TODAY'S ACTIVITY</AppText>
          </View>
          <View>
            <AppText style={styles.heroValue}>{formatRwf(activitySummary.todayEarningsRwf)}</AppText>
            <AppText style={styles.heroCaption}>Activity Earnings</AppText>
          </View>
          <View style={styles.heroMetrics}>
            <HeroMetric label={hasTripsToday ? 'Completed Trips' : 'No trips yet'} value={String(activitySummary.completedRidesToday)} />
            <View style={styles.heroDivider} />
            <HeroMetric label="Rides" value={isEntitlementLoading ? '...' : String(rideCredits)} />
            <View style={styles.heroDivider} />
            <HeroMetric label="Driver Rating" value={ratingSummary.ratingCount > 0 ? ratingValue : 'No ratings yet'} compact />
          </View>
          {!hasTripsToday ? <AppText style={styles.heroEmptyText}>No trips completed today yet.</AppText> : null}
        </LinearGradient>

        <View style={styles.section}>
          <SectionHeader title="Performance Overview" />
          <View style={styles.metricGrid}>
            <MetricTile
              colors={colors}
              icon="check-circle"
              label="Today"
              note="Completed trips"
              value={String(activitySummary.completedRidesToday)}
              tone={colors.successHex}
            />
            <MetricTile
              colors={colors}
              icon="percent"
              label="Acceptance"
              note={acceptanceRateNote}
              value={acceptanceRateValue}
              tone={colors.primaryHex}
            />
            <MetricTile
              colors={colors}
              icon="award"
              label="All-time"
              note="Completed trips"
              value={String(dp.completedRides)}
              tone={colors.primaryHex}
            />
            <MetricTile
              colors={colors}
              icon="star"
              iconColor={colors.primaryHex}
              label="Rating"
              note={ratingSummary.ratingCount > 0 ? `${ratingSummary.ratingCount} ratings` : 'No ratings yet'}
              value={ratingValue}
              tone={colors.primaryHex}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Driver Performance" />
          <View style={[styles.surface, styles.cardShadow, { backgroundColor: colors.card }]}>
            <PerformanceStatus colors={colors} priorityReduced={priorityReduced} declinesToday={declinesToday} />
            <View style={[styles.softDivider, { backgroundColor: colors.border }]} />
            <View style={styles.performanceStats}>
              <CompactStat label="Daily Declines" value={String(declinesToday)} colors={colors} />
              <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
              <CompactStat label="Completed Trips" value={String(dp.completedRides)} colors={colors} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Activity Earnings" />
          <View style={[styles.surface, styles.cardShadow, { backgroundColor: colors.card }]}>
            <DetailRow colors={colors} icon="trending-up" label="Ride Revenue" note="From completed trips" value={formatRwf(activitySummary.allTimeEarningsRwf)} />
            <DetailRow colors={colors} icon="smartphone" label="Mobile Money Details" value={paymentTarget} last />
          </View>
        </View>

        <PurchaseHistoryCard purchases={entitlement.purchaseHistory} />
      </GlassScrollView>
    </View>
  );
}

function HeroMetric({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return <View style={styles.heroMetric}>
    <AppText style={[styles.heroMetricValue, compact && styles.heroMetricValueCompact]} numberOfLines={1}>{value}</AppText>
    <AppText style={styles.heroMetricLabel} numberOfLines={1}>{label}</AppText>
  </View>;
}

function MetricTile({ colors, icon, iconColor, label, note, tone, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof Feather.glyphMap; iconColor?: string; label: string; note: string; tone: string; value: string;
}) {
  return <View style={[styles.metricTile, styles.cardShadow, { backgroundColor: colors.card }]}>
    <View style={styles.metricTopRow}>
      {icon === 'star' && iconColor
        ? <AppText style={{ ...typography.h3, lineHeight: 22, color: iconColor }}>★</AppText>
        : <Feather name={icon} size={icons.semantic.row} color={iconColor ?? colors.foreground} />}
      <AppText style={[styles.metricLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</AppText>
    </View>
    <AppText style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
  </View>;
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</AppText>;
}

function PerformanceStatus({ colors, declinesToday, priorityReduced }: {
  colors: ReturnType<typeof useColors>; declinesToday: number; priorityReduced: boolean;
}) {
  return <View style={styles.performanceStatus}>
    <Feather name={priorityReduced ? 'alert-triangle' : 'zap'} size={icons.size.lg} color={priorityReduced ? colors.destructive : colors.primary} />
    <View style={styles.performanceStatusCopy}>
      <AppText style={[styles.performanceStatusTitle, { color: priorityReduced ? colors.destructive : colors.foreground }]}>
        {priorityReduced ? 'Lower Priority' : 'High Priority'}
      </AppText>
      <AppText style={[styles.performanceStatusNote, { color: colors.mutedForeground }]}>
        {priorityReduced
          ? 'Priority was reduced after 10 or more declines today.'
          : `${10 - declinesToday} more declines before priority is reduced.`}
      </AppText>
    </View>
  </View>;
}

function CompactStat({ colors, label, value }: { colors: ReturnType<typeof useColors>; label: string; value: string }) {
  return <View style={styles.compactStat}>
    <AppText style={[styles.compactStatValue, { color: colors.foreground }]}>{value}</AppText>
    <AppText style={[styles.compactStatLabel, { color: colors.mutedForeground }]}>{label}</AppText>
  </View>;
}

function DetailRow({ colors, icon, label, last = false, note, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof Feather.glyphMap; label: string; last?: boolean; note?: string; value: string;
}) {
  return <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
    <Feather name={icon} size={icons.semantic.row} color={colors.primary} />
    <View style={styles.detailLabelGroup}>
      <AppText style={[styles.detailLabel, { color: colors.foreground }]}>{label}</AppText>
      {note ? <AppText style={[styles.detailNote, { color: colors.mutedForeground }]}>{note}</AppText> : null}
    </View>
    <AppText style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={1}>{value}</AppText>
  </View>;
}

function PurchaseHistoryCard({ purchases }: { purchases: DriverPackagePurchase[] }) {
  const colors = useColors();
  const recentPurchases = purchases.slice(0, 3);

  return <View style={styles.section}>
    <SectionHeader title="Package History" />
    <View style={[styles.surface, styles.cardShadow, { backgroundColor: colors.card }]}>
      {recentPurchases.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Feather name="clock" size={21} color={colors.mutedForeground} />
          <AppText style={[styles.emptyHistoryText, { color: colors.mutedForeground }]}>No package history yet</AppText>
        </View>
      ) : recentPurchases.map((purchase, index) => {
        const purchaseSnapshot = getPackagePurchaseSnapshot(purchase);
        const statusColor = getPurchaseStatusColor(purchase.status, colors);
        return <View
          key={purchase.transactionId}
          style={[styles.historyRow, index < recentPurchases.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
        >
          <Feather name="package" size={icons.semantic.row} color={colors.primary} />
          <View style={styles.historyLabelGroup}>
            <AppText style={[styles.historyName, { color: colors.foreground }]}>{purchaseSnapshot?.packageName ?? purchase.packageId}</AppText>
            <AppText style={[styles.historyMeta, { color: colors.mutedForeground }]}>
              {purchaseSnapshot ? `${purchaseSnapshot.ridesGranted} Rides + ${purchaseSnapshot.bonusRidesGranted} Bonus Rides` : 'Package snapshot unavailable'}
            </AppText>
            <AppText style={[styles.historyMeta, { color: colors.mutedForeground }]}>
              {formatHistoryDate(purchaseSnapshot?.purchasedAt ?? purchase.purchasedAt ?? purchase.createdAt)} - {purchase.provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
            </AppText>
          </View>
          <View style={styles.historyTotals}>
            <AppText style={[styles.historyPrice, { color: colors.foreground }]}>{formatRwf(purchaseSnapshot?.pricePaid ?? purchase.pricePaid ?? purchase.amount)}</AppText>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '12' }]}>
              <AppText style={[styles.historyStatus, { color: statusColor }]}>{formatPurchaseStatus(purchase.status)}</AppText>
            </View>
          </View>
        </View>;
      })}
    </View>
  </View>;
}

function getPurchaseStatusColor(status: DriverPackagePurchaseStatus, colors: ReturnType<typeof useColors>) {
  if (status === 'successful') return colors.successHex;
  if (status === 'pending' || status === 'processing') return colors.warningHex;
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return colors.destructiveHex;
  return colors.mutedForeground;
}

function formatPurchaseStatus(status: DriverPackagePurchaseStatus) {
  if (status === 'successful') return 'Successful';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  if (status === 'processing') return 'Processing';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  return 'Idle';
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  todayChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  todayChipText: { ...typography.tiny,  },
  heroCard: { borderRadius: 26, padding: semanticSpacing.screenPadding, gap: icons.semantic.row, overflow: 'hidden' },
  heroShadow: { shadowColor: '#007AFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 7 },
  heroHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: 'rgba(255,255,255,0.76)', ...typography.tiny, letterSpacing: 0.9 },
  heroValue: { color: '#fff', ...typography.displayXL, lineHeight: 40, letterSpacing: -1 },
  heroCaption: { color: 'rgba(255,255,255,0.72)', ...typography.caption, marginTop: spacing[2] },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetric: { flex: 1, minWidth: 0, gap: 3 },
  heroMetricValue: { color: '#fff', ...typography.title,  },
  heroMetricValueCompact: { ...typography.caption },
  heroMetricLabel: { color: 'rgba(255,255,255,0.68)', ...typography.tiny,  },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: 9, backgroundColor: 'rgba(255,255,255,0.26)' },
  heroEmptyText: { color: 'rgba(255,255,255,0.72)', ...typography.tiny, marginTop: -8 },
  section: { gap: 11 },
  sectionTitle: { ...typography.title, letterSpacing: -0.2, marginLeft: spacing[2] },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: semanticSpacing.inlineGap },
  metricTile: { flexGrow: 1, flexBasis: '47%', minWidth: 120, minHeight: 88, borderRadius: radius.card, padding: spacing[10], gap: 3 },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  metricValue: { ...typography.h3, lineHeight: 23, letterSpacing: -0.5, marginTop: spacing[2] },
  metricLabel: { flex: 1, ...typography.tiny,  },
  metricNote: { ...typography.tiny, lineHeight: 13 },
  cardShadow: { ...elevation.card, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }) },
  surface: { borderRadius: radius['3xl'], overflow: 'hidden' },
  performanceStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: semanticSpacing.rowGap, padding: semanticSpacing.cardPadding },
  performanceStatusCopy: { flex: 1, gap: spacing[4] },
  performanceStatusTitle: { ...typography.body,  },
  performanceStatusNote: { ...typography.tiny, lineHeight: 17 },
  softDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: semanticSpacing.cardPadding },
  performanceStats: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  compactStat: { flex: 1, alignItems: 'center', gap: 3 },
  compactStatValue: { ...typography.h2, letterSpacing: -0.4 },
  compactStatLabel: { ...typography.tiny,  },
  verticalDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  detailLabelGroup: { flex: 1, gap: spacing[2] },
  detailLabel: { ...typography.label,  },
  detailNote: { ...typography.tiny,  },
  detailValue: { maxWidth: '44%', textAlign: 'right', ...typography.label,  },
  emptyHistory: { alignItems: 'center', gap: 9, padding: semanticSpacing.sectionGap },
  emptyHistoryText: { ...typography.caption,  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[10], padding: spacing[14] },
  historyLabelGroup: { flex: 1, minWidth: 0 },
  historyName: { ...typography.label,  },
  historyMeta: { ...typography.tiny, marginTop: 3 },
  historyTotals: { alignItems: 'flex-end', gap: 5 },
  historyPrice: { ...typography.caption,  },
  statusPill: { paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: spacing[4], borderRadius: radius.pill },
  historyStatus: { ...typography.tiny,  },
});
