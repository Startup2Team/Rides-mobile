import { useSyncExternalStore } from 'react';
import { domainDeadLetters, domainEventReplay, domainEventStore, domainProjectors } from '../store/singleton';

function getSnapshot() {
  const store = domainEventStore.getSnapshot();
  const replay = domainEventReplay.getSnapshot();
  return {
    eventCount: store.eventCount,
    projectorCount: domainProjectors.getSnapshot().size,
    lastEvent: store.lastEvent,
    deadLetterCount: domainDeadLetters.size(),
    replayStatus: replay.status,
  };
}

export function useEventPlatform() {
  return useSyncExternalStore(
    () => () => undefined,
    getSnapshot,
    getSnapshot,
  );
}
