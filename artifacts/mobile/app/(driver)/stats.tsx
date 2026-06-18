import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  DRIVER_RIDE_PACKAGES,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
} from '@/domain/driverRidePackages';
import { useRide } from '@/context/RideContext';
import { formatRwf, getDriverActivitySummary } from '@/domain/driverActivitySummary';
import { formatDriverRatingSummary, getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverStats() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user, driverProfile } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const { rideHistory, loadHistory } = useRide();
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
        subtitle="Track your driver performance"
        showBack={false}
        titleAccessory={<View style={[styles.todayChip, { backgroundColor: colors.primaryHex + '14' }]}><Text style={[styles.todayChipText, { color: colors.primary }]}>Today</Text></View>}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 24,
          paddingHorizontal: 16,
          gap: 24,
        }}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryHex, colors.primaryHex + 'D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, styles.heroShadow]}
        >
          <View style={styles.heroHeading}>
            <Text style={styles.heroEyebrow}>TODAY'S ACTIVITY</Text>
          </View>
          <View>
            <Text style={styles.heroValue}>{formatRwf(activitySummary.todayEarningsRwf)}</Text>
            <Text style={styles.heroCaption}>Activity Earnings</Text>
          </View>
          <View style={styles.heroMetrics}>
            <HeroMetric label={hasTripsToday ? 'Completed Trips' : 'No trips yet'} value={String(activitySummary.completedRidesToday)} />
            <View style={styles.heroDivider} />
            <HeroMetric label="Rides" value={isEntitlementLoading ? '...' : String(rideCredits)} />
            <View style={styles.heroDivider} />
            <HeroMetric label="Driver Rating" value={ratingSummary.ratingCount > 0 ? ratingValue : 'No ratings yet'} compact />
          </View>
          {!hasTripsToday ? <Text style={styles.heroEmptyText}>No trips completed today yet.</Text> : null}
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
          <SectionHeader title="Ride Package" />
          <TouchableOpacity
            style={[styles.packageCard, styles.cardShadow, { backgroundColor: colors.card }]}
            onPress={() => router.push('/driver-packages')}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="View ride packages"
          >
            <Feather name="layers" size={20} color={colors.primary} />
            <View style={styles.packageHeader}>
              <View style={styles.packageTitleGroup}>
                <Text style={[styles.packageName, { color: colors.foreground }]}>
                  Ride Packages
                </Text>
                <Text style={[styles.packageMeta, { color: colors.mutedForeground }]}>
                  Explore package options for your driving needs
                </Text>
              </View>
            </View>
            <View style={[styles.packageAction, { backgroundColor: colors.primary }]}>
              <Text style={[styles.packageActionText, { color: colors.primaryForeground }]}>View Packages</Text>
            </View>
          </TouchableOpacity>
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
      </ScrollView>
    </View>
  );
}

function HeroMetric({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return <View style={styles.heroMetric}>
    <Text style={[styles.heroMetricValue, compact && styles.heroMetricValueCompact]} numberOfLines={1}>{value}</Text>
    <Text style={styles.heroMetricLabel} numberOfLines={1}>{label}</Text>
  </View>;
}

function MetricTile({ colors, icon, iconColor, label, note, tone, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof Feather.glyphMap; iconColor?: string; label: string; note: string; tone: string; value: string;
}) {
  return <View style={[styles.metricTile, styles.cardShadow, { backgroundColor: colors.card }]}>
    <View style={styles.metricTopRow}>
      {icon === 'star' && iconColor
        ? <Text style={{ fontSize: 18, lineHeight: 22, color: iconColor }}>★</Text>
        : <Feather name={icon} size={18} color={iconColor ?? colors.foreground} />}
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
    </View>
    <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
  </View>;
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function PerformanceStatus({ colors, declinesToday, priorityReduced }: {
  colors: ReturnType<typeof useColors>; declinesToday: number; priorityReduced: boolean;
}) {
  return <View style={styles.performanceStatus}>
    <Feather name={priorityReduced ? 'alert-triangle' : 'zap'} size={20} color={priorityReduced ? colors.destructive : colors.primary} />
    <View style={styles.performanceStatusCopy}>
      <Text style={[styles.performanceStatusTitle, { color: priorityReduced ? colors.destructive : colors.foreground }]}>
        {priorityReduced ? 'Lower Priority' : 'High Priority'}
      </Text>
      <Text style={[styles.performanceStatusNote, { color: colors.mutedForeground }]}>
        {priorityReduced
          ? 'Priority was reduced after 10 or more declines today.'
          : `${10 - declinesToday} more declines before priority is reduced.`}
      </Text>
    </View>
  </View>;
}

function CompactStat({ colors, label, value }: { colors: ReturnType<typeof useColors>; label: string; value: string }) {
  return <View style={styles.compactStat}>
    <Text style={[styles.compactStatValue, { color: colors.foreground }]}>{value}</Text>
    <Text style={[styles.compactStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
  </View>;
}

function DetailRow({ colors, icon, label, last = false, note, value }: {
  colors: ReturnType<typeof useColors>; icon: keyof typeof Feather.glyphMap; label: string; last?: boolean; note?: string; value: string;
}) {
  return <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
    <Feather name={icon} size={18} color={colors.primary} />
    <View style={styles.detailLabelGroup}>
      <Text style={[styles.detailLabel, { color: colors.foreground }]}>{label}</Text>
      {note ? <Text style={[styles.detailNote, { color: colors.mutedForeground }]}>{note}</Text> : null}
    </View>
    <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
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
          <Text style={[styles.emptyHistoryText, { color: colors.mutedForeground }]}>No package history yet</Text>
        </View>
      ) : recentPurchases.map((purchase, index) => {
        const ridePackage = DRIVER_RIDE_PACKAGES[purchase.packageId];
        const statusColor = getPurchaseStatusColor(purchase.status, colors);
        return <View
          key={purchase.transactionId}
          style={[styles.historyRow, index < recentPurchases.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
        >
          <Feather name="package" size={18} color={colors.primary} />
          <View style={styles.historyLabelGroup}>
            <Text style={[styles.historyName, { color: colors.foreground }]}>{ridePackage.name}</Text>
            <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
              {formatHistoryDate(purchase.createdAt)} - {purchase.provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
            </Text>
          </View>
          <View style={styles.historyTotals}>
            <Text style={[styles.historyPrice, { color: colors.foreground }]}>{formatRwf(purchase.amount)}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '12' }]}>
              <Text style={[styles.historyStatus, { color: statusColor }]}>{formatPurchaseStatus(purchase.status)}</Text>
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
  todayChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  todayChipText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  heroCard: { borderRadius: 26, padding: 20, gap: 18, overflow: 'hidden' },
  heroShadow: { shadowColor: '#007AFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 7 },
  heroHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: 'rgba(255,255,255,0.76)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.9 },
  heroValue: { color: '#fff', fontSize: 34, lineHeight: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroCaption: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetric: { flex: 1, minWidth: 0, gap: 3 },
  heroMetricValue: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  heroMetricValueCompact: { fontSize: 12 },
  heroMetricLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 9, fontFamily: 'Inter_500Medium' },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: 9, backgroundColor: 'rgba(255,255,255,0.26)' },
  heroEmptyText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: -8 },
  section: { gap: 11 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginLeft: 2 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricTile: { flexGrow: 1, flexBasis: '47%', minWidth: 120, minHeight: 88, borderRadius: 14, padding: 10, gap: 3 },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricValue: { fontSize: 19, lineHeight: 23, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginTop: 2 },
  metricLabel: { flex: 1, fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  metricNote: { fontSize: 9, fontFamily: 'Inter_400Regular', lineHeight: 13 },
  cardShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3, ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }) },
  surface: { borderRadius: 20, overflow: 'hidden' },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
  packageHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  packageTitleGroup: { flex: 1, gap: 3 },
  packageName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  packageMeta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  packageAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 100 },
  packageActionText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  performanceStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  performanceStatusCopy: { flex: 1, gap: 4 },
  performanceStatusTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  performanceStatusNote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  softDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  performanceStats: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  compactStat: { flex: 1, alignItems: 'center', gap: 3 },
  compactStatValue: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  compactStatLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  verticalDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  detailLabelGroup: { flex: 1, gap: 2 },
  detailLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  detailNote: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  detailValue: { maxWidth: '44%', textAlign: 'right', fontSize: 13, fontFamily: 'Inter_700Bold' },
  emptyHistory: { alignItems: 'center', gap: 9, padding: 24 },
  emptyHistoryText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  historyLabelGroup: { flex: 1, minWidth: 0 },
  historyName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  historyMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  historyTotals: { alignItems: 'flex-end', gap: 5 },
  historyPrice: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  historyStatus: { fontSize: 9, fontFamily: 'Inter_700Bold' },
});
