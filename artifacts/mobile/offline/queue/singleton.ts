import { createNetworkMonitor } from '../network/networkMonitor';
import { OfflineMutationQueue } from './offlineQueue';
import { createOfflineScheduler } from '../scheduler/offlineScheduler';

export const offlineQueue = new OfflineMutationQueue();
export const offlineNetwork = createNetworkMonitor();
export const offlineScheduler = createOfflineScheduler(offlineQueue, offlineNetwork);
