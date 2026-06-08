import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { DRIVER_RIDE_PACKAGES } from '@/domain/driverRidePackages';

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
  const { driverProfile } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;

  const dp = driverProfile ?? {
    dailyRides: 0,
    completedRides: 0,
    acceptanceRate: 0,
    dailyDeclines: 0,
    earningsTotal: 0,
  };

  // earningsTotal is accumulated from actual agreedFare on each completed ride.
  // Daily figures are estimated (no per-ride fare breakdown stored yet).
  const ESTIMATED_AVG_FARE = 2800;
  const dailyDecisionCount = dp.dailyRides + (dp.dailyDeclines ?? 0);
  const acceptanceRateValue = dailyDecisionCount > 0 ? `${dp.acceptanceRate}%` : 'No data';
  const acceptanceRateNote = dailyDecisionCount > 0 ? undefined : 'After your first ride decision';
  const dailyGrossEstimate = dp.dailyRides * ESTIMATED_AVG_FARE;
  const dailyFeeEstimate = Math.round(dailyGrossEstimate * 0.15);
  const dailyPayoutEstimate = dailyGrossEstimate - dailyFeeEstimate;
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

      {/* Today */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>TODAY</Text>
        <StatRow label="Rides Completed" value={String(dp.dailyRides)} icon="navigation" />
        <StatRow label="Rides Declined" value={String(dp.dailyDeclines ?? 0)} icon="x" color={colors.destructiveHex} />
        <StatRow
          label="Est. Gross Earnings"
          value={`~${dailyGrossEstimate.toLocaleString()} RWF`}
          icon="dollar-sign"
          color={colors.primaryHex}
          note="Estimated · avg fare used"
        />
        <StatRow
          label="Est. Platform Fee"
          value={`~${dailyFeeEstimate.toLocaleString()} RWF`}
          icon="percent"
          note="Estimated · 15%"
        />
        <StatRow
          label="Est. Today's Payout"
          value={`~${dailyPayoutEstimate.toLocaleString()} RWF`}
          icon="credit-card"
          color={colors.primaryHex}
          note="Estimated"
        />
        <StatRow label="Payment Target" value={paymentTarget} icon="smartphone" />
      </View>

      {/* Overall */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>ALL TIME</Text>
        <StatRow label="Total Rides" value={String(dp.completedRides)} icon="award" />
        <StatRow
          label="Acceptance Rate"
          value={acceptanceRateValue}
          icon="check-circle"
          color={colors.primaryHex}
          note={acceptanceRateNote}
        />
        <StatRow
          label="Total Earnings"
          value={`${(dp.earningsTotal ?? 0).toLocaleString()} RWF`}
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
          Total Earnings reflects the sum of all agreed fares from your completed rides. Daily figures marked "Est." use an average fare and may differ from actual payouts.
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
  priorityRow: { padding: 16, gap: 12 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  priorityText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  priorityDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  infoCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
