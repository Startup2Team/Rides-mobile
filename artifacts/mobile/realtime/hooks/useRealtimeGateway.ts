import { useSyncExternalStore } from 'react';
import { realtimeGateway } from '../connection/singleton';

export function useRealtimeGateway() {
  return useSyncExternalStore(
    listener => realtimeGateway.subscribe(listener),
    () => realtimeGateway.getSnapshot(),
    () => realtimeGateway.getSnapshot(),
  );
}
