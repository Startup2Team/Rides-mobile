import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useRealtimeGateway } from '../hooks/useRealtimeGateway';

export function RealtimeInspector({ visible = false }: { visible?: boolean }) {
  const realtime = useRealtimeGateway();
  if (!visible) return null;

  return (
    <View style={styles.root} testID="realtime-inspector">
      <AppText variant="label">Realtime</AppText>
      <AppText variant="tiny">Connection: {realtime.presence}</AppText>
      <AppText variant="tiny">Latency: {realtime.heartbeat.latencyMs ?? 'unknown'}</AppText>
      <AppText variant="tiny">Subscriptions: {realtime.subscriptions.size}</AppText>
      <AppText variant="tiny">Heartbeat: {realtime.heartbeat.running ? 'running' : 'stopped'}</AppText>
      <AppText variant="tiny">Reconnects: {realtime.reconnectCount}</AppText>
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
