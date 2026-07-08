import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

export interface DriverStatisticsSupportingRow {
  label: string;
  value: string;
  note?: string;
}

interface DriverStatisticsSupportingCardProps {
  rows: DriverStatisticsSupportingRow[];
  onPress?: () => void;
}

export function DriverStatisticsSupportingCard({ rows, onPress }: DriverStatisticsSupportingCardProps) {
  const colors = useColors();

  const cardContent = (
    <View style={styles.inner}>
      <View style={styles.header}>
        <AppText style={[styles.title, { color: colors.foreground }]}>Performance</AppText>
        {onPress && (
          <View style={[styles.chevronBadge, { backgroundColor: colors.border }]}>
            <Feather name="chevron-right" size={10} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[styles.row, index < rows.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={styles.labelGroup}>
              <AppText style={[styles.label, { color: colors.foreground }]}>{row.label}</AppText>
              {row.note ? <AppText style={[styles.note, { color: colors.mutedForeground }]}>{row.note}</AppText> : null}
            </View>
            <AppText style={[styles.value, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
              {row.value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Performance card. Tap to see performance details."
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
    borderRadius: radius['3xl'],
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
    gap: spacing[10],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
  },
  rows: {
    gap: spacing[0],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  labelGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  label: {
    ...typography.label,
  },
  note: {
    ...typography.tiny,
  },
  value: {
    ...typography.label,
    maxWidth: '44%',
    textAlign: 'right',
  },
  chevronBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
