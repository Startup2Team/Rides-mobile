import type { QueryClient } from '@tanstack/react-query';
import type { OfflineMutationQueue } from '@/offline/queue/offlineQueue';
import type { RealtimeConnectionManager } from '@/realtime/connection/connectionManager';
import type { InMemoryEventStore } from '@/events/store/inMemoryEventStore';
import type { HealthMonitor, HealthStatus } from './healthMonitor';

export function registerOfflineQueueHealth(monitor: HealthMonitor, queue: OfflineMutationQueue) {
  return monitor.register({
    name: 'offline_queue',
    check: () => queue.getSnapshot().paused ? 'degraded' : 'healthy',
  });
}

export function registerRealtimeHealth(monitor: HealthMonitor, realtime: RealtimeConnectionManager) {
  return monitor.register({
    name: 'realtime',
    check: () => {
      const presence = realtime.getSnapshot().presence;
      if (presence === 'Degraded') return 'degraded';
      if (presence === 'Offline') return 'unknown';
      return 'healthy';
    },
  });
}

export function registerEventEngineHealth(monitor: HealthMonitor, store: InMemoryEventStore) {
  return monitor.register({
    name: 'event_engine',
    check: () => store.getSnapshot().eventCount >= 0 ? 'healthy' : 'unknown',
  });
}

export function registerQueryCacheHealth(monitor: HealthMonitor, queryClient: QueryClient) {
  return monitor.register({
    name: 'query_cache',
    check: () => {
      const errored = queryClient.getQueryCache().getAll().some(query => query.state.status === 'error');
      return errored ? 'degraded' : 'healthy';
    },
  });
}

export function registerStorageHealth(monitor: HealthMonitor, check: () => Promise<boolean> | boolean) {
  return monitor.register({
    name: 'storage',
    check: async (): Promise<HealthStatus> => await check() ? 'healthy' : 'unhealthy',
  });
}

export function registerNetworkHealth(monitor: HealthMonitor, isOnline: () => boolean) {
  return monitor.register({
    name: 'network',
    check: () => isOnline() ? 'healthy' : 'degraded',
  });
}
