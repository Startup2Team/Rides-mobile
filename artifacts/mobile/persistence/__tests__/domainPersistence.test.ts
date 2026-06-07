import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/constants/storage';
import { createRide } from '@/context/ride/__tests__/rideTestFactory';
import {
  loadStoredDriverProfile,
  loadStoredUser,
  saveStoredDriverProfile,
  saveStoredUser,
} from '../authPersistence';
import {
  loadStoredSavedLocations,
  saveStoredSavedLocations,
} from '../savedLocationsPersistence';
import { loadVersionedStorage, saveVersionedStorage } from '../versionedStorage';
import { rideHistorySchema } from '../storageSchemas';
import type { DriverProfile, SavedLocation, User } from '@/types';

const user: User = {
  id: 'user-1',
  name: 'Customer',
  phone: '+250788000000',
  mode: 'customer',
  isDriver: false,
  createdAt: '2026-06-06T10:00:00.000Z',
};

const driverProfile: DriverProfile = {
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  licenseNumber: 'license-1',
  province: 'Kigali',
  district: 'Gasabo',
  sector: 'Kacyiru',
  momoCode: '123456',
  momoProvider: 'mtn',
  dob: '1990-01-01',
  isOnline: false,
  isVerified: true,
  acceptanceRate: 95,
  completedRides: 20,
  dailyRides: 2,
  dailyDeclines: 0,
  policyAccepted: true,
  earningsTotal: 50000,
};

const savedLocation: SavedLocation = {
  id: 'saved-1',
  label: 'Home',
  address: 'Kigali',
  latitude: -1.94,
  longitude: 30.06,
  locationType: 'precise',
};

describe('domain persistence validation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    jest.restoreAllMocks();
  });

  test('validates current auth user and driver profile envelopes', async () => {
    await saveStoredUser(user);
    await saveStoredDriverProfile(driverProfile);

    await expect(loadStoredUser()).resolves.toEqual({ data: user, source: 'current' });
    await expect(loadStoredDriverProfile()).resolves.toEqual({
      data: driverProfile,
      source: 'current',
    });
    await expect(AsyncStorage.getItem(STORAGE_KEYS.user)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_KEYS.driverProfile)).resolves.toBeNull();
  });

  test('migrates legacy saved locations and ride history', async () => {
    const ride = createRide({ status: 'completed' });
    await AsyncStorage.setItem(STORAGE_KEYS.savedLocations, JSON.stringify([savedLocation]));
    await AsyncStorage.setItem(STORAGE_KEYS.rideHistory, JSON.stringify([ride]));

    await expect(loadStoredSavedLocations()).resolves.toEqual({
      data: [savedLocation],
      source: 'legacy',
    });
    await expect(AsyncStorage.getItem(STORAGE_KEYS.savedLocations)).resolves.toBeNull();
    await expect(
      loadVersionedStorage(STORAGE_KEYS.rideHistory, rideHistorySchema),
    ).resolves.toEqual({ data: [ride], source: 'legacy' });
  });

  test('rejects invalid auth and saved-location shapes safely', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ ...user, mode: 'admin' }));
    await saveVersionedStorage(STORAGE_KEYS.savedLocations, [{ ...savedLocation, latitude: 'invalid' }]);

    await expect(loadStoredUser()).resolves.toEqual({ data: null, source: 'invalid' });
    await expect(loadStoredSavedLocations()).resolves.toEqual({
      data: null,
      source: 'invalid',
    });
  });

  test('persists saved locations in the current validated envelope', async () => {
    await saveStoredSavedLocations([savedLocation]);

    await expect(loadStoredSavedLocations()).resolves.toEqual({
      data: [savedLocation],
      source: 'current',
    });
  });
});
