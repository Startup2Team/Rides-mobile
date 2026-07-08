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
  const displayEarnings = earningsLabel.replace(/\s*RWF/gi, '');

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
      {/* Header Block at the Top */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <AppText style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            Earnings
          </AppText>
          {periodLabel && periodLabel.toLowerCase() !== 'today' ? (
            <AppText style={[styles.period, { color: colors.mutedForeground }]} numberOfLines={1}>
              {periodLabel}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        {/* Progress Ring on the Left */}
        <View style={styles.ringWrapper}>
          <ProgressRing
            size={140}
            strokeWidth={28}
            progress={progress}
            color={colors.primaryHex}
            showArrow={true}
          />
        </View>

        {/* Value on the Right */}
        <View style={styles.valueWrapper}>
          <AppText style={[styles.targetLabel, { color: colors.foreground }]}>Target</AppText>
          <View style={styles.valuesContainer}>
            <AppText style={[styles.value, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {`${displayEarnings} / ${targetLabel}`}
            </AppText>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[8],
    paddingRight: spacing[24],
    marginBottom: spacing[12],
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  title: {
    ...typography.label,
    fontSize: 13,
  },
  period: {
    ...typography.tiny,
  },
  targetLabel: {
    ...typography.tiny,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  valueWrapper: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  valuesContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
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
