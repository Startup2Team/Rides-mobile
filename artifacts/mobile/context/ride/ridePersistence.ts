import { STORAGE_KEYS } from '@/constants/storage';
import { Ride } from '@/types';
import { rideHistorySchema } from '@/persistence/storageSchemas';
import { loadSecureStorage, saveSecureStorage } from '@/persistence/secureStorage';
import { RIDE_HISTORY_LIMIT } from './rideConstants';

export async function appendRideHistory(completed: Ride): Promise<void> {
  const stored = await loadSecureStorage<Ride[]>(STORAGE_KEYS.rideHistory, rideHistorySchema);
  const history = stored.data ?? [];
  await saveSecureStorage(
    STORAGE_KEYS.rideHistory,
    [completed, ...history].slice(0, RIDE_HISTORY_LIMIT),
  );
}

export async function loadRideHistory(): Promise<Ride[] | null> {
  const stored = await loadSecureStorage<Ride[]>(STORAGE_KEYS.rideHistory, rideHistorySchema);
  return stored.data;
}
