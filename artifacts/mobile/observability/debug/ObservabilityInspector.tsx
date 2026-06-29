import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useObservability } from '../hooks/useObservability';

export function ObservabilityInspector({ visible = false }: { visible?: boolean }) {
  const snapshot = useObservability();
  if (!visible) return null;

  return (
    <View style={styles.root} testID="observability-inspector">
      <AppText variant="label">Observability</AppText>
      <AppText variant="tiny">Health: {snapshot.health.status}</AppText>
      <AppText variant="tiny">Metrics: {snapshot.metrics}</AppText>
      <AppText variant="tiny">Traces: {snapshot.traces}</AppText>
      <AppText variant="tiny">Logs: {snapshot.logs}</AppText>
      <AppText variant="tiny">Crashes: {snapshot.crashes}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    bottom: 0,
    left: 0,
    padding: 12,
    position: 'absolute',
    right: 0,
    zIndex: 9999,
  },
});
