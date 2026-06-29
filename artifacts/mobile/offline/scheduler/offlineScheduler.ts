import type { NetworkMonitor } from '../network/networkMonitor';
import type { OfflineMutationQueue } from '../queue/offlineQueue';

export interface OfflineScheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

export function createOfflineScheduler(
  queue: OfflineMutationQueue,
  network: NetworkMonitor,
  intervalMs = 5_000,
): OfflineScheduler {
  let timer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeNetwork: (() => void) | null = null;

  const tick = async () => {
    await queue.process();
  };

  return {
    start() {
      if (!unsubscribeNetwork) {
        unsubscribeNetwork = network.subscribe(state => {
          queue.setNetworkState(state);
          if (state.isOnline) void tick();
        });
      }
      if (!timer) {
        timer = setInterval(() => { void tick(); }, intervalMs);
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      unsubscribeNetwork?.();
      unsubscribeNetwork = null;
    },
    tick,
  };
}
