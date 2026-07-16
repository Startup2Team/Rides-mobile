import React from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';
import { useCustomerLevelQuery } from '@/query/hooks/useCustomerLevelQuery';
import type { CustomerLevelTier } from '@/services/customerLevel';

// Tier accent palette (single source of truth for the gamification look).
const TIER_COLOR: Record<CustomerLevelTier, string> = {
  BRONZE: '#CD7F32',
  SILVER: '#9AA0A6',
  GOLD: '#F5B301',
  PREMIUM: '#7C3AED',
};

const TIER_LABEL: Record<CustomerLevelTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PREMIUM: 'Premium',
};

export function CustomerLevelCard() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const trackColor = isDark ? 'rgba(84,84,88,0.5)' : 'rgba(60,60,67,0.12)';

  const { data, isLoading, isError } = useCustomerLevelQuery();

  // Error: fail quietly — the loyalty card is supplementary and must never
  // block the profile screen.
  if (isError) return null;

  if (isLoading || !data) {
    return (
      <View
        style={[styles.card, styles.centered, { backgroundColor: cardFill }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading your rewards level"
      >
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  const accent = TIER_COLOR[data.level];
  const tierName = TIER_LABEL[data.level];
  const pct = Math.round(data.progressToNext * 100);
  const atTop = !data.nextLevel;

  const progressLabel = atTop
    ? `You've reached the top tier, ${tierName}.`
    : `${data.ridesToNextLevel} more ride${data.ridesToNextLevel === 1 ? '' : 's'} to ${TIER_LABEL[data.nextLevel!]}`;

  return (
    <View
      style={[styles.card, { backgroundColor: cardFill }]}
      accessibilityRole="summary"
      accessibilityLabel={`Rewards level ${tierName}. ${progressLabel}. ${data.completedRides} completed rides.`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: accent + '1F' }]}>
          <Feather name="award" size={20} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="label" style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            Rewards level
          </AppText>
          <AppText variant="title" style={[styles.tier, { color: colors.foreground }]}>
            {tierName}
          </AppText>
        </View>
        <View style={styles.ridesStat}>
          <AppText variant="title" style={[styles.ridesCount, { color: accent }]}>
            {data.completedRides}
          </AppText>
          <AppText variant="label" style={[styles.ridesCaption, { color: colors.mutedForeground }]}>
            rides
          </AppText>
        </View>
      </View>

      {!atTop && (
        <View style={styles.progressWrap}>
          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <View style={[styles.fill, { width: `${Math.max(4, pct)}%`, backgroundColor: accent }]} />
          </View>
        </View>
      )}

      <AppText variant="label" style={[styles.progressLabel, { color: colors.mutedForeground }]}>
        {progressLabel}
      </AppText>

      {data.perks.length > 0 && (
        <View style={styles.perks}>
          {data.perks.map(perk => (
            <View key={perk} style={styles.perkRow}>
              <Feather name="check" size={14} color={accent} />
              <AppText variant="label" style={[styles.perkText, { color: colors.foreground }]}>
                {perk}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  centered: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  tier: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 1,
  },
  ridesStat: {
    alignItems: 'flex-end',
  },
  ridesCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  ridesCaption: {
    fontSize: 12,
  },
  progressWrap: {
    marginTop: 14,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  progressLabel: {
    marginTop: 8,
    fontSize: 13,
  },
  perks: {
    marginTop: 12,
    gap: 6,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    fontSize: 13,
    flex: 1,
  },
});
