import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';
import type { DriverStatisticsPeriod } from '@/domains/driver-statistics';

const PERIOD_OPTIONS: Array<{ label: string; value: DriverStatisticsPeriod }> = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

interface DriverStatisticsPeriodSelectorProps {
  selectedPeriod: DriverStatisticsPeriod;
  onChange: (period: DriverStatisticsPeriod) => void;
}

export function DriverStatisticsPeriodSelector({ onChange, selectedPeriod }: DriverStatisticsPeriodSelectorProps) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {PERIOD_OPTIONS.map(option => {
        const selected = option.value === selectedPeriod;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={`Show ${option.label} statistics`}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              { backgroundColor: selected ? colors.primaryHex : 'transparent' },
            ]}
          >
            <AppText
              style={[
                styles.optionText,
                { color: selected ? colors.primaryForeground : colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: spacing[4],
  },
  option: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  optionText: {
    ...typography.label,
  },
});
