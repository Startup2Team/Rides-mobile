import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export function QueueInspector({ visible = false }: { visible?: boolean }) {
  const queue = useOfflineQueue();
  if (!visible) return null;

  return (
    <View style={styles.root} testID="offline-queue-inspector">
      <AppText variant="label">Offline Queue</AppText>
      <AppText variant="tiny">Size: {queue.size}</AppText>
      <AppText variant="tiny">Processing: {queue.processing ? 'yes' : 'no'}</AppText>
      <AppText variant="tiny">Paused: {queue.paused ? 'yes' : 'no'}</AppText>
      <AppText variant="tiny">Retry count: {queue.retryCount}</AppText>
      <AppText variant="tiny">Oldest: {queue.oldestMutation?.id ?? 'none'}</AppText>
      <AppText variant="tiny">Network: {queue.network.isOnline ? 'online' : 'offline'}</AppText>
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
