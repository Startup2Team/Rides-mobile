import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const overallTone = snapshot.activeRide.tone === 'critical' || snapshot.history.tone === 'critical' || snapshot.detail.tone === 'critical'
    ? 'critical'
    : snapshot.activeRide.tone === 'warning' || snapshot.history.tone === 'warning' || snapshot.detail.tone === 'warning'
      ? 'warning'
      : snapshot.activeRide.tone === 'healthy' || snapshot.history.tone === 'healthy' || snapshot.detail.tone === 'healthy'
        ? 'healthy'
        : 'idle';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="ride-canary-inspector"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerTitleText}>
            <AppText variant="label" style={[styles.title, { color: colors.foreground }]}>
              Ride Canary Inspector
            </AppText>
            <AppText variant="tiny" style={{ color: colors.mutedForeground }}>
              Environment: {process.env.NODE_ENV ?? 'unknown'}
            </AppText>
          </View>
          <AppText variant="caption" style={[styles.overallTone, { color: toneColor(overallTone, colors) }]}>
            {overallTone}
          </AppText>
        </View>
        <AppText variant="tiny" style={{ color: colors.mutedForeground }}>
          Query cache: {inspector.queryCacheSize} | Last refreshed: {snapshot.report.generatedAt}
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

function toneColor(tone: string, colors: ReturnType<typeof useColors>) {
  if (tone === 'critical') return colors.destructive;
  if (tone === 'warning') return colors.warning;
  if (tone === 'healthy') return colors.success;
  return colors.mutedForeground;
}

function toneIndicatorColor(tone: string, colors: ReturnType<typeof useColors>) {
  if (tone === 'critical') return colors.destructiveHex;
  if (tone === 'warning') return colors.warningHex;
  if (tone === 'healthy') return colors.successHex;
  return colors.border;
}

export function RideCanaryInspectorLauncher() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inspector = useRideCanaryInspector();
  const [open, setOpen] = useState(false);

  if (!isRideCanaryInspectorVisible() || !inspector.visible) return null;

  const tones = [inspector.snapshot.history.tone, inspector.snapshot.detail.tone, inspector.snapshot.activeRide.tone];
  const overallTone = tones.includes('critical')
    ? 'critical'
    : tones.includes('warning')
      ? 'warning'
      : tones.includes('healthy')
        ? 'healthy'
        : 'idle';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Ride Canary Inspector"
        testID="ride-canary-launcher"
        onPress={() => setOpen(true)}
        style={[
          styles.launcher,
          {
            right: Math.max(12, insets.right + 12),
            bottom: Math.max(96, insets.bottom + 88),
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.launcherDot, { backgroundColor: toneIndicatorColor(overallTone, colors) }]} />
        <AppText variant="tiny" style={[styles.launcherText, { color: colors.foreground }]}>CANARY</AppText>
      </Pressable>
      <Modal
        animationType="fade"
        visible={open}
        transparent={false}
        onRequestClose={() => setOpen(false)}
        testID="ride-canary-inspector-modal"
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.headerTitleText}>
              <AppText variant="label" style={[styles.title, { color: colors.foreground }]}>Ride Canary Inspector</AppText>
              <AppText variant="tiny" style={{ color: colors.mutedForeground }}>
                Current environment: {process.env.NODE_ENV ?? 'unknown'}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Ride Canary Inspector" onPress={() => setOpen(false)} style={[styles.closeButton, { borderColor: colors.border }]}>
              <AppText variant="caption" style={{ color: colors.foreground }}>Close</AppText>
            </Pressable>
          </View>
          <RideCanaryInspector />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  content: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    gap: 2,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleText: {
    flex: 1,
    gap: 2,
  },
  title: {
    flexShrink: 1,
  },
  overallTone: {
    textTransform: 'uppercase',
  },
  launcher: {
    position: 'absolute',
    zIndex: 10000,
    elevation: 12,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  launcherDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  launcherText: {
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 58,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
