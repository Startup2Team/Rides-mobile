import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * True when the device has no usable internet connection.
 *
 * React Query's `onlineManager` is not wired to NetInfo in this app, so
 * `fetchStatus === 'paused'` is not a dependable offline signal. Screens that
 * must render offline as a DESIGNED state (rather than as an error toast) read
 * this instead. Same detection rule as `components/OfflineBanner`.
 */
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof NetInfo?.addEventListener !== 'function') return;
    const unsubscribe = NetInfo.addEventListener((state: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  return isOffline;
}
