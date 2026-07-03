import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import type { useColors } from '@/hooks/useColors';
import type { RideCanaryInspectorTone } from './RideCanaryInspectorHooks';

export function RideCanaryInspectorCard({
  colors,
  title,
  tone,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  title: string;
  tone: RideCanaryInspectorTone;
  children: React.ReactNode;
}) {
  const borderColor =
    tone === 'idle'
      ? colors.border
      : tone === 'healthy'
      ? colors.successHex
      : tone === 'warning'
        ? colors.warningHex
        : colors.destructiveHex;
  const toneColor =
    tone === 'idle'
      ? colors.mutedForeground
      : tone === 'healthy'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : colors.destructive;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor }]}>
      <View style={styles.header}>
        <AppText variant="label" style={[styles.title, { color: colors.foreground }]}>{title}</AppText>
        <AppText variant="caption" style={[styles.tone, { color: toneColor }]}>{tone}</AppText>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flexShrink: 1,
  },
  tone: {
    textTransform: 'uppercase',
  },
  content: {
    gap: 6,
  },
});
