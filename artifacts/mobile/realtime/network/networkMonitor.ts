import NetInfo from '@react-native-community/netinfo';
import { createListenerSet } from '@/state/storeUtils';

export interface RealtimeNetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

export interface RealtimeNetworkMonitor {
  getSnapshot(): RealtimeNetworkState;
  subscribe(listener: (state: RealtimeNetworkState) => void): () => void;
  setOnlineForTests?(isOnline: boolean): void;
}

function toOnline(isConnected: boolean | null | undefined, isInternetReachable: boolean | null | undefined) {
  return Boolean(isConnected) && isInternetReachable !== false;
}

export function createRealtimeNetworkMonitor(
  initial: RealtimeNetworkState = { isOnline: true, isInternetReachable: true },
): RealtimeNetworkMonitor {
  let state = initial;
  const listeners = createListenerSet<RealtimeNetworkState>();
  let unsubscribeNative: (() => void) | null = null;

  const notify = (next: RealtimeNetworkState) => {
    state = next;
    listeners.notify(state);
  };

  const subscribe = (listener: (next: RealtimeNetworkState) => void) => {
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
