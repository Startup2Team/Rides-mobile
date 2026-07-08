import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { loadVersionedStorage, saveVersionedStorage } from '@/persistence/versionedStorage';
import type { OfflineQueueState } from '../types';

export const OFFLINE_QUEUE_STORAGE_KEY = '@rides_offline_queue';

const pendingMutationSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  type: z.string(),
  payload: z.any(),
  createdAt: z.string(),
  updatedAt: z.string(),
  retryCount: z.number().int().nonnegative(),
  nextRetryAt: z.string().nullable(),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  status: z.enum(['pending', 'processing', 'paused', 'failed', 'cancelled', 'expired', 'completed']),
  expiresAt: z.string().nullable(),
  lastError: z.string().nullable(),
  collapseKey: z.string().optional(),
  collapseStrategy: z.enum(['none', 'replace-latest']).optional(),
});

const offlineQueueStateSchema = z.object({
  mutations: z.array(pendingMutationSchema),
  paused: z.boolean(),
  processing: z.boolean(),
});

export async function saveOfflineQueueState(state: OfflineQueueState) {
  await saveVersionedStorage(OFFLINE_QUEUE_STORAGE_KEY, {
    ...state,
    processing: false,
    mutations: state.mutations.filter(mutation => !['completed', 'cancelled', 'expired'].includes(mutation.status)),
  });
}

export async function loadOfflineQueueState(): Promise<OfflineQueueState> {
  const stored = await loadVersionedStorage(OFFLINE_QUEUE_STORAGE_KEY, offlineQueueStateSchema);
  return (stored.data as OfflineQueueState | null) ?? { mutations: [], paused: false, processing: false };
}

export async function clearOfflineQueueState() {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
}
