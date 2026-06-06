import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { Ride } from '@/types';
import { RIDE_HISTORY_LIMIT } from './rideConstants';

export async function appendRideHistory(completed: Ride): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.rideHistory);
  const history: Ride[] = stored ? JSON.parse(stored) : [];
  await AsyncStorage.setItem(
    STORAGE_KEYS.rideHistory,
    JSON.stringify([completed, ...history].slice(0, RIDE_HISTORY_LIMIT)),
  );
}

export async function loadRideHistory(): Promise<Ride[] | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.rideHistory);
  return stored ? JSON.parse(stored) : null;
}
