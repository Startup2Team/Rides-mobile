import { STORAGE_KEYS } from '@/constants/storage';
import { Ride } from '@/types';
import { rideHistorySchema } from '@/persistence/storageSchemas';
import { loadVersionedStorage, saveVersionedStorage } from '@/persistence/versionedStorage';
import { RIDE_HISTORY_LIMIT } from './rideConstants';

export async function appendRideHistory(completed: Ride): Promise<void> {
  const stored = await loadVersionedStorage<Ride[]>(STORAGE_KEYS.rideHistory, rideHistorySchema);
  const history = stored.data ?? [];
  await saveVersionedStorage(
    STORAGE_KEYS.rideHistory,
    [completed, ...history].slice(0, RIDE_HISTORY_LIMIT),
  );
}

export async function loadRideHistory(): Promise<Ride[] | null> {
  const stored = await loadVersionedStorage<Ride[]>(STORAGE_KEYS.rideHistory, rideHistorySchema);
  return stored.data;
}
