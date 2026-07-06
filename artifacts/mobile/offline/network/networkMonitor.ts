import NetInfo from '@react-native-community/netinfo';
import { createListenerSet } from '@/state/storeUtils';
import type { OfflineNetworkState } from '../types';

export interface NetworkMonitor {
  getSnapshot(): OfflineNetworkState;
  subscribe(listener: (state: OfflineNetworkState) => void): () => void;
  setOnlineForTests?(isOnline: boolean): void;
}

function toOnline(isConnected: boolean | null | undefined, isInternetReachable: boolean | null | undefined) {
  return Boolean(isConnected) && isInternetReachable !== false;
}

export function createNetworkMonitor(initial: OfflineNetworkState = { isOnline: true, isInternetReachable: true }): NetworkMonitor {
  let state = initial;
  const listeners = createListenerSet<OfflineNetworkState>();
  let unsubscribeNative: (() => void) | null = null;

  const notify = (next: OfflineNetworkState) => {
    state = next;
    listeners.notify(state);
  };

  const subscribe = (listener: (next: OfflineNetworkState) => void) => {
    const removeListener = listeners.add(listener);
    if (!unsubscribeNative && typeof NetInfo?.addEventListener === 'function') {
      unsubscribeNative = NetInfo.addEventListener(info => {
        notify({
          isOnline: toOnline(info.isConnected, info.isInternetReachable),
          isInternetReachable: info.isInternetReachable ?? null,
        });
      });
    }
    return () => {
      removeListener();
      if (listeners.size() === 0 && unsubscribeNative) {
        unsubscribeNative();
        unsubscribeNative = null;
      }
    };
  };

  return {
    getSnapshot: () => state,
    subscribe,
    setOnlineForTests: isOnline => notify({ isOnline, isInternetReachable: isOnline }),
  };
}
