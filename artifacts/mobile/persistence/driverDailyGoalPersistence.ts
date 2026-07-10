import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverDailyGoalRecord } from '@/domains/driver-statistics';
import { driverDailyGoalsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredDriverDailyGoals = () =>
  loadSecureStorage<DriverDailyGoalRecord[]>(STORAGE_KEYS.driverDailyGoals, driverDailyGoalsSchema);

export const saveStoredDriverDailyGoals = (records: DriverDailyGoalRecord[]) =>
  saveSecureStorage(STORAGE_KEYS.driverDailyGoals, records);
