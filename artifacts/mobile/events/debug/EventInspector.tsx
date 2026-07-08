import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useEventPlatform } from '../hooks/useEventPlatform';

export function EventInspector({ visible = false }: { visible?: boolean }) {
  const events = useEventPlatform();
  if (!visible) return null;

  return (
    <View style={styles.root} testID="event-inspector">
      <AppText variant="label">Domain Events</AppText>
      <AppText variant="tiny">Events: {events.eventCount}</AppText>
      <AppText variant="tiny">Projectors: {events.projectorCount}</AppText>
      <AppText variant="tiny">Last event: {events.lastEvent?.eventType ?? 'none'}</AppText>
      <AppText variant="tiny">Dead letters: {events.deadLetterCount}</AppText>
      <AppText variant="tiny">Replay: {events.replayStatus}</AppText>
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
