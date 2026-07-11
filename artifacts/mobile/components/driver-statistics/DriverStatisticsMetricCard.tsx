import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';
import { DriverStatisticsMiniBars, type DriverStatisticsMiniBarLabel } from './DriverStatisticsMiniBars';

interface DriverStatisticsMetricCardProps {
  title: string;
  periodLabel?: string;
  value: string;
  note?: string;
  icon?: keyof typeof Feather.glyphMap;
  values?: number[];
  labels?: DriverStatisticsMiniBarLabel[];
  chartAccessibilityLabel?: string;
  color?: string;
  onPress?: () => void;
}

export function DriverStatisticsMetricCard({
  chartAccessibilityLabel,
  icon,
  labels,
  note,
  periodLabel,
  title,
  value,
  values,
  color,
  onPress,
}: DriverStatisticsMetricCardProps) {
  const colors = useColors();
  const themeColor = color || colors.foreground;

  const cardContent = (
    <View style={styles.inner}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <AppText style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{title}</AppText>
          {periodLabel ? <AppText style={[styles.period, { color: colors.mutedForeground }]} numberOfLines={1}>{periodLabel}</AppText> : null}
        </View>
        {!onPress && icon ? <Feather name={icon} size={16} color={themeColor} /> : null}
      </View>
      <AppText style={[styles.value, { color: themeColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {note ? <AppText style={[styles.note, { color: colors.mutedForeground }]} numberOfLines={2}>{note}</AppText> : null}
      {values ? (
        <DriverStatisticsMiniBars
          values={values}
          labels={labels}
          color={themeColor}
          accessibilityLabel={chartAccessibilityLabel ?? `${title} activity for ${periodLabel ?? 'selected period'}`}
        />
      ) : null}

      {/* Top-Right Chevron Indicator for tapable cards */}
      {onPress && (
        <View style={[styles.chevronBadge, { backgroundColor: colors.border }]}>
          <Feather name="chevron-right" size={10} color={colors.mutedForeground} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${value}. Tap to see details.`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    flex: 1,
    minWidth: 0,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    ...Platform.select({ web: { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' } }),
  },
  inner: {
    padding: semanticSpacing.cardPadding,
    gap: spacing[8],
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[8],
    paddingRight: spacing[16], // Ensure text doesn't overlap chevron badge
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
  value: {
    ...typography.h2,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: spacing[4],
  },
  note: {
    ...typography.tiny,
    lineHeight: 14,
  },
  chevronBadge: {
    position: 'absolute',
    top: spacing[10],
    right: spacing[10],
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
