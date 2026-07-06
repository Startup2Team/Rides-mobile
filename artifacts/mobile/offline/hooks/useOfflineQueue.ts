import { useSyncExternalStore } from 'react';
import { offlineQueue } from '../queue/singleton';

export function useOfflineQueue() {
  return useSyncExternalStore(
    listener => offlineQueue.subscribe(listener),
    () => offlineQueue.getSnapshot(),
    () => offlineQueue.getSnapshot(),
  );
}
