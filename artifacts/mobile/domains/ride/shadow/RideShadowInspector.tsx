import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { rideShadowProjectionManager } from './shadowProjectionManager';

export function RideShadowInspector({ visible = false }: { visible?: boolean }) {
  const snapshot = rideShadowProjectionManager.getSnapshot();
  if (!visible) return null;

  return (
    <View style={styles.root} testID="ride-shadow-inspector">
      <AppText variant="label">Ride Shadow Projection</AppText>
      <AppText variant="tiny">Status: {snapshot.projectionStatus}</AppText>
      <AppText variant="tiny">Last event: {snapshot.lastProcessedEvent?.eventType ?? 'none'}</AppText>
      <AppText variant="tiny">Active diff: {snapshot.lastComparison?.activeRideDiff.length ?? 0}</AppText>
      <AppText variant="tiny">History diff: {snapshot.lastComparison?.historyDiff.length ?? 0}</AppText>
      <AppText variant="tiny">Driver request diff: {snapshot.lastComparison?.driverRequestDiff.length ?? 0}</AppText>
      <AppText variant="tiny">Comparisons: {snapshot.comparisonCount}</AppText>
      <AppText variant="tiny">Mismatches: {snapshot.mismatchCount}</AppText>
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
