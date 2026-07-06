import React from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import type { useColors } from '@/hooks/useColors';
import type { ActiveRideUiSummary } from '@/domains/ride/projection/activeRideUiModel';

export function ActiveRideProjectionSummary({
  colors,
  summary,
}: {
  colors: ReturnType<typeof useColors>;
  summary: ActiveRideUiSummary;
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <AppText style={[styles.label, { color: colors.mutedForeground }]}>Source</AppText>
        <AppText style={[styles.value, { color: colors.foreground }]}>{summary.source}</AppText>
      </View>
      <View style={styles.row}>
        <AppText style={[styles.label, { color: colors.mutedForeground }]}>Phase</AppText>
        <AppText style={[styles.value, { color: colors.foreground }]}>{summary.phaseLabel}</AppText>
      </View>
      <View style={styles.row}>
        <AppText style={[styles.label, { color: colors.mutedForeground }]}>Status</AppText>
        <AppText style={[styles.value, { color: colors.foreground }]}>{summary.statusMessage}</AppText>
      </View>
      <View style={styles.row}>
        <AppText style={[styles.label, { color: colors.mutedForeground }]}>ETA</AppText>
        <AppText style={[styles.value, { color: colors.foreground }]}>{summary.etaText ?? 'n/a'}</AppText>
      </View>
    </View>
  );
}

const styles = {
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400' as const,
    flexShrink: 1,
    textAlign: 'right' as const,
  },
};
