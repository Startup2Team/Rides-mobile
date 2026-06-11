import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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

function StatRow({
  label,
  value,
  icon,
  color,
  note,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  note?: string;
}) {
  const colors = useColors();
  const iconColor = color ?? colors.primaryHex;
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconColor + '20' }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.statLabelGroup}>
        <Text style={[styles.statLabel, { color: colors.foreground }]}>{label}</Text>
        {note ? <Text style={[styles.statNote, { color: colors.mutedForeground }]}>{note}</Text> : null}
      </View>
      <Text style={[styles.statValue, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function DriverStats() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, driverProfile } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const { rideHistory, loadHistory } = useRide();
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;
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

  const dailyDecisionCount = dp.dailyRides + (dp.dailyDeclines ?? 0);
  const acceptanceRateValue = dailyDecisionCount > 0 ? `${dp.acceptanceRate}%` : 'No data';
  const acceptanceRateNote = dailyDecisionCount > 0 ? undefined : 'After your first ride decision';
  const activitySummary = getDriverActivitySummary({ driverId: user?.id, driverProfile, entitlement, rideHistory });
  const paymentTarget = driverProfile?.momoCode || driverProfile?.merchantCode || 'Not set';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 20,
        padding: 20,
        gap: 20,
      }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Driver Statistics</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>RIDE PACKAGE</Text>
        <StatRow
          label="Active Plan"
          value={isEntitlementLoading ? 'Checking...' : activePackage?.name ?? 'No active package'}
          icon="layers"
        />
        <StatRow
          label="Remaining Credits"
          value={isEntitlementLoading ? 'Checking...' : String(rideCredits)}
          icon="navigation"
          color={rideCredits <= 10 ? colors.destructiveHex : colors.primaryHex}
        />
      </View>

      <PurchaseHistoryCard purchases={entitlement.purchaseHistory} />

      {/* Today */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>TODAY</Text>
        <StatRow
          label="Activity Earnings Today"
          value={formatRwf(activitySummary.todayEarningsRwf)}
          icon="dollar-sign"
          color={colors.primaryHex}
        />
        <StatRow label="Rides Completed" value={String(activitySummary.completedRidesToday)} icon="navigation" />
        <StatRow label="Rides Declined" value={String(dp.dailyDeclines ?? 0)} icon="x" color={colors.destructiveHex} />
        <StatRow label="Mobile Money Details" value={paymentTarget} icon="smartphone" />
      </View>

      {/* Overall */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>ALL TIME</Text>
        <StatRow label="Total Rides" value={String(dp.completedRides)} icon="award" />
        <StatRow label="Rating" value={formatDriverRatingSummary(ratingSummary)} icon="star" color={colors.primaryHex} />
        <StatRow
          label="Acceptance Rate"
          value={acceptanceRateValue}
          icon="check-circle"
          color={colors.primaryHex}
          note={acceptanceRateNote}
        />
        <StatRow
          label="Activity Earnings Total"
          value={formatRwf(activitySummary.allTimeEarningsRwf)}
          icon="trending-up"
          color={colors.primaryHex}
          note="From completed rides"
        />
      </View>

      {/* Priority system */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>PRIORITY STATUS</Text>
        <View style={styles.priorityRow}>
          <View style={styles.priorityBadge}>
            <Feather name="star" size={16} color={colors.star} />
            <Text style={[styles.priorityText, { color: colors.star }]}>High Priority</Text>
          </View>
          <Text style={[styles.priorityDesc, { color: colors.mutedForeground }]}>
            {dp.dailyDeclines >= 10
              ? '⚠ You have been moved to lower priority queue today due to 10+ declines.'
              : `${10 - (dp.dailyDeclines ?? 0)} more declines before priority is reduced.`}
          </Text>
        </View>
      </View>

      {/* Earnings disclaimer */}
      <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Activity Earnings reflect agreed fares from completed rides only. Customers pay drivers directly through Mobile Money or cash; Rides does not hold these funds.
        </Text>
      </View>

      {/* Policy reminder */}
      <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Declining 10 or more rides in one day moves you to a lower priority queue. Maintain a high acceptance rate to receive more ride requests.
        </Text>
      </View>
    </ScrollView>
  );
}

function PurchaseHistoryCard({ purchases }: { purchases: DriverPackagePurchase[] }) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>PURCHASE HISTORY</Text>
      {purchases.length === 0 ? (
        <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>No purchase history yet.</Text>
      ) : purchases.map(purchase => {
        const ridePackage = DRIVER_RIDE_PACKAGES[purchase.packageId];
        return (
          <View key={purchase.transactionId} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
            <View style={styles.historyLabelGroup}>
              <Text style={[styles.historyName, { color: colors.foreground }]}>{ridePackage.name}</Text>
              <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                {formatHistoryDate(purchase.createdAt)} - {purchase.provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
              </Text>
            </View>
            <View style={styles.historyTotals}>
              <Text style={[styles.historyStatus, { color: colors.foreground }]}>{formatPurchaseStatus(purchase.status)}</Text>
              <Text style={[styles.historyPrice, { color: colors.mutedForeground }]}>{formatRwf(purchase.amount)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
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
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, padding: 16, paddingBottom: 8 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabelGroup: { flex: 1 },
  statLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  statNote: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyHistory: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, padding: 16, paddingTop: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  historyLabelGroup: { flex: 1 },
  historyName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  historyMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  historyTotals: { alignItems: 'flex-end' },
  historyStatus: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  historyPrice: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
  priorityRow: { padding: 16, gap: 12 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  priorityText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  priorityDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  infoCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
