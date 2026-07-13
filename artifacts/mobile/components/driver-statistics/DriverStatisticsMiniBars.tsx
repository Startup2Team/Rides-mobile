import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

export interface DriverStatisticsMiniBarLabel {
  index: number;
  label: string;
}

interface DriverStatisticsMiniBarsProps {
  values: number[];
  labels?: DriverStatisticsMiniBarLabel[];
  accessibilityLabel: string;
  height?: number;
  color?: string;
}

export function DriverStatisticsMiniBars({
  accessibilityLabel,
  height = 58,
  labels = [],
  values,
  color,
}: DriverStatisticsMiniBarsProps) {
  const colors = useColors();
  const maxValue = values.reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0);
  const labelMap = new Map(labels.map(label => [label.index, label.label]));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.chart, { height }]} testID="driver-statistics-mini-bars">
        {values.map((value, index) => {
          const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
          const ratio = maxValue > 0 ? safeValue / maxValue : 0;
          const barHeight = ratio > 0 ? Math.max(4, Math.round(ratio * height)) : 0;
          return (
            <View key={`${index}-${safeValue}`} style={styles.barSlot}>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  testID="driver-statistics-mini-bar"
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: safeValue > 0 ? (color || colors.primaryHex) : 'transparent',
                      height: barHeight,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      {labels.length > 0 ? (
        <View style={styles.labels}>
          {values.map((_, index) => (
            <View key={index} style={styles.labelSlot}>
              {labelMap.has(index) ? (
                <AppText style={[styles.axisLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {labelMap.get(index)}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  barSlot: {
    flex: 1,
    minWidth: 2,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    height: '100%',
    borderRadius: radius.pill,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    opacity: 0.9,
  },
  barFill: {
    borderRadius: radius.pill,
    width: '100%',
  },
  labels: {
    flexDirection: 'row',
    marginTop: spacing[6],
  },
  labelSlot: {
    flex: 1,
    minWidth: 2,
    alignItems: 'center',
  },
  axisLabel: {
    ...typography.tiny,
    lineHeight: 13,
  },
});
