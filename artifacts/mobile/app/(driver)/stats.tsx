import React, { useState, useCallback } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { getDailyEarnings, getWeeklyEarnings, getDriverStats } from '@/services/driverRides';
import type { DailyEarnings, WeeklyEarnings, DriverStats as DriverStatsData } from '@/services/driverRides';

function StatRow({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
}) {
  const colors = useColors();
  const iconColor = color ?? colors.primaryHex;
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconColor + '20' }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.statLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-RW').format(Math.round(n));
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function priorityLabel(tier: string): string {
  switch (tier?.toUpperCase()) {
    case 'GOLD':
      return '🥇 Gold Priority';
    case 'SILVER':
      return '🥈 Silver Priority';
    case 'BRONZE':
      return '🥉 Bronze Priority';
    default:
      return '⭐ Standard Priority';
  }
}

export default function DriverStats() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { driverProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyEarnings | null>(null);
  const [weekly, setWeekly] = useState<WeeklyEarnings | null>(null);
  const [stats, setStats] = useState<DriverStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, w, s] = await Promise.all([
        getDailyEarnings(),
        getWeeklyEarnings(),
        getDriverStats(),
      ]);
      setDaily(d);
      setWeekly(w);
      setStats(s);
    } catch {
      setError('Could not load stats. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh every time this tab comes into focus
  useFocusEffect(load);

  const paymentTarget = driverProfile?.momoCode || 'Not set';

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

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primaryHex} />
        </View>
      )}

      {!loading && error && (
        <View style={[styles.errorCard, { backgroundColor: colors.destructiveHex + '18', borderColor: colors.destructiveHex + '40' }]}>
          <Feather name="alert-circle" size={16} color={colors.destructiveHex} />
          <Text style={[styles.errorText, { color: colors.destructiveHex }]}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <>
          {/* Today */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>TODAY</Text>
            <StatRow
              label="Today's Payout"
              value={`${fmt(daily?.total_rwf ?? 0)} RWF`}
              icon="credit-card"
              color={colors.primaryHex}
            />
            <StatRow
              label="Payment Target"
              value={paymentTarget}
              icon="smartphone"
            />
          </View>

          {/* This week */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>LAST 7 DAYS</Text>
            <StatRow
              label="Weekly Payout"
              value={`${fmt(weekly?.total_rwf ?? 0)} RWF`}
              icon="trending-up"
              color={colors.primaryHex}
            />
          </View>

          {/* All-time performance */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>ALL TIME</Text>
            <StatRow
              label="Total Rides"
              value={String(stats?.total_rides ?? 0)}
              icon="award"
            />
            <StatRow
              label="Acceptance Rate"
              value={pct(stats?.acceptance_rate ?? 0)}
              icon="check-circle"
              color={colors.primaryHex}
            />
            <StatRow
              label="Completion Rate"
              value={pct(stats?.completion_rate ?? 0)}
              icon="flag"
              color={colors.primaryHex}
            />
          </View>

          {/* Priority status */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>PRIORITY STATUS</Text>
            <View style={styles.priorityRow}>
              <View style={styles.priorityBadge}>
                <Feather name="star" size={16} color={colors.star} />
                <Text style={[styles.priorityText, { color: colors.star }]}>
                  {priorityLabel(stats?.priority_tier ?? '')}
                </Text>
              </View>
              <Text style={[styles.priorityDesc, { color: colors.mutedForeground }]}>
                Maintain a high acceptance rate to receive more ride requests and unlock higher priority tiers.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Policy reminder — always visible */}
      <View style={[styles.infoCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Your payout is credited daily. Earnings shown are after the platform fee has been deducted.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  errorCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    padding: 16,
    paddingBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  priorityRow: { padding: 16, gap: 12 },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  priorityText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  priorityDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
