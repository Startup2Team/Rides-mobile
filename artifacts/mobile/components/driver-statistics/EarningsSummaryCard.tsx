import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';
import { ProgressRing } from './ProgressRing';
import { formatRwf } from '@/domain/driverActivitySummary';

interface EarningsSummaryCardProps {
  periodLabel: string;
  earningsLabel: string;
  completedTrips: number;
  periodEarnings: number;
  targetEarnings?: number;
  onPress?: () => void;
}

const PINK_RED = '#FF2D55';

export function EarningsSummaryCard({
  completedTrips,
  earningsLabel,
  periodLabel,
  periodEarnings,
  targetEarnings = 30000, // Default target
  onPress,
}: EarningsSummaryCardProps) {
  const colors = useColors();

  // Adjust target based on period label
  let activeTarget = targetEarnings;
  const lowerPeriod = periodLabel.toLowerCase();
  if (lowerPeriod.includes('week')) {
    activeTarget = 150000;
  } else if (lowerPeriod.includes('month')) {
    activeTarget = 600000;
  }

  const progress = activeTarget > 0 ? periodEarnings / activeTarget : 0;
  const targetLabel = formatRwf(activeTarget);

  return (
    <Pressable
      accessible
      accessibilityLabel={`Earnings for ${periodLabel}. ${earningsLabel} of ${targetLabel} target. ${completedTrips} completed trips.`}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed && onPress ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Progress Ring on the Left */}
        <View style={styles.ringWrapper}>
          <ProgressRing
            size={100}
            strokeWidth={12}
            progress={progress}
            color={PINK_RED}
            trackColor="rgba(255, 45, 85, 0.12)"
          >
            {/* Small arrow inside the ring matching the visual style */}
            <Feather name="arrow-right" size={16} color={PINK_RED} style={styles.ringArrow} />
          </ProgressRing>
        </View>

        {/* Copy Block on the Right */}
        <View style={styles.copy}>
          <AppText style={[styles.eyebrow, { color: colors.mutedForeground }]}>Earnings</AppText>
          <View style={styles.valuesContainer}>
            <AppText style={[styles.value, { color: PINK_RED }]} numberOfLines={1} adjustsFontSizeToFit>
              {earningsLabel}
            </AppText>
            <AppText style={[styles.target, { color: colors.mutedForeground }]}>
              / {targetLabel}
            </AppText>
          </View>
          <AppText style={[styles.context, { color: colors.mutedForeground }]}>
            {completedTrips} completed {completedTrips === 1 ? 'trip' : 'trips'}
          </AppText>
        </View>
      </View>

      {/* Top-Right Chevron Indicator */}
      {onPress && (
        <View style={[styles.chevronBadge, { backgroundColor: colors.border }]}>
          <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['3xl'],
    padding: semanticSpacing.cardPadding,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[16],
  },
  ringWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringArrow: {
    transform: [{ rotate: '-45deg' }],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  eyebrow: {
    ...typography.label,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  valuesContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  value: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  target: {
    ...typography.caption,
    fontSize: 14,
    marginLeft: spacing[4],
  },
  context: {
    ...typography.caption,
    fontSize: 13,
  },
  chevronBadge: {
    position: 'absolute',
    top: spacing[12],
    right: spacing[12],
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
