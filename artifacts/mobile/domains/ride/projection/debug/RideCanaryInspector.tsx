import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/hooks/useColors';
import { RideCanaryInspectorActionRow, RideCanaryInspectorPrimaryAction, RideCanaryInspectorSection } from './RideCanaryInspectorSection';
import { isRideCanaryInspectorVisible, useRideCanaryInspector } from './RideCanaryInspectorHooks';

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

export function RideCanaryInspector() {
  const colors = useColors();
  const inspector = useRideCanaryInspector();

  if (!isRideCanaryInspectorVisible() || !inspector.visible) return null;

  const { snapshot } = inspector;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="ride-canary-inspector"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <AppText variant="label" style={[styles.title, { color: colors.foreground }]}>
          Ride Canary Inspector
        </AppText>
        <AppText variant="tiny" style={{ color: colors.mutedForeground }}>
          Query cache: {inspector.queryCacheSize}
        </AppText>
      </View>

      <RideCanaryInspectorSection
        colors={colors}
        title="Monitoring Report"
        tone={snapshot.activeRide.tone}
        fields={[
          { label: 'History readiness', value: yesNo(snapshot.readiness.historyReady) },
          { label: 'Detail readiness', value: yesNo(snapshot.readiness.detailReady) },
          { label: 'Active readiness', value: yesNo(snapshot.readiness.activeReady) },
          { label: 'Rollout gate', value: snapshot.rolloutGate.reason },
          { label: 'Rollout eligible', value: yesNo(snapshot.rolloutGate.eligible) },
          { label: 'Stability', value: snapshot.stability.ready ? 'ready' : snapshot.stability.reason },
          { label: 'Recommendation', value: snapshot.report.recommendedAction },
        ]}
      />

      <RideCanaryInspectorSection
        colors={colors}
        title="History"
        tone={snapshot.history.tone}
        fields={[
          { label: 'Status', value: snapshot.history.status },
          { label: 'Projected Reads', value: snapshot.history.projectedReads },
          { label: 'Live Reads', value: snapshot.history.liveReads },
          { label: 'Fallbacks', value: snapshot.history.fallbacks },
          { label: 'Mismatches', value: snapshot.history.mismatches },
          { label: 'Stale Events', value: snapshot.history.staleEvents },
          { label: 'Mapping Failures', value: snapshot.history.mappingFailures },
          { label: 'Rollback Count', value: snapshot.history.rollbackCount },
          { label: 'Readiness', value: snapshot.history.readiness },
          { label: 'Recommendation', value: snapshot.history.recommendation },
        ]}
      />

      <RideCanaryInspectorSection
        colors={colors}
        title="Ride Detail"
        tone={snapshot.detail.tone}
        fields={[
          { label: 'Status', value: snapshot.detail.status },
          { label: 'Projected Reads', value: snapshot.detail.projectedReads },
          { label: 'Live Reads', value: snapshot.detail.liveReads },
          { label: 'Fallbacks', value: snapshot.detail.fallbacks },
          { label: 'Mismatches', value: snapshot.detail.mismatches },
          { label: 'Stale Events', value: snapshot.detail.staleEvents },
          { label: 'Mapping Failures', value: snapshot.detail.mappingFailures },
          { label: 'Rollback Count', value: snapshot.detail.rollbackCount },
          { label: 'Readiness', value: snapshot.detail.readiness },
          { label: 'Recommendation', value: snapshot.detail.recommendation },
        ]}
      />

      <RideCanaryInspectorSection
        colors={colors}
        title="Active Ride"
        tone={snapshot.activeRide.tone}
        fields={[
          { label: 'Status', value: snapshot.activeRide.status },
          { label: 'Projected Reads', value: snapshot.activeRide.projectedReads },
          { label: 'Live Reads', value: snapshot.activeRide.liveReads },
          { label: 'Fallbacks', value: snapshot.activeRide.fallbacks },
          { label: 'Mismatches', value: snapshot.activeRide.mismatches },
          { label: 'Stale Events', value: snapshot.activeRide.staleEvents },
          { label: 'Mapping Failures', value: snapshot.activeRide.mappingFailures },
          { label: 'Rollback Count', value: snapshot.activeRide.rollbackCount },
          { label: 'Readiness', value: snapshot.activeRide.readiness },
          { label: 'Recommendation', value: snapshot.activeRide.recommendation },
        ]}
      />

      <RideCanaryInspectorActionRow colors={colors}>
        <RideCanaryInspectorPrimaryAction title="Refresh Report" onPress={inspector.refresh} icon="refresh-cw" />
        <RideCanaryInspectorPrimaryAction title="Reset Metrics" onPress={inspector.resetMetrics} icon="trash-2" />
        <RideCanaryInspectorPrimaryAction title="Force Live" onPress={inspector.forceLive} icon="shield" />
        <RideCanaryInspectorPrimaryAction title="Simulate Rollback" onPress={inspector.simulateRollback} icon="alert-triangle" />
        <RideCanaryInspectorPrimaryAction title="Export Report (JSON)" onPress={() => void inspector.exportReport()} icon="download" />
      </RideCanaryInspectorActionRow>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    maxHeight: '86%',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  content: {
    gap: 10,
  },
  header: {
    gap: 2,
    paddingHorizontal: 2,
  },
  title: {
    flexShrink: 1,
  },
});
