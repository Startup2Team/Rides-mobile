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
import {
  loadStoredDriverOnboardingDraft,
  removeStoredDriverOnboardingDraft,
  saveStoredDriverOnboardingDraft,
} from '../driverOnboardingPersistence';
import { INITIAL_DRIVER_DOCUMENTS, INITIAL_DRIVER_ONBOARDING_FORM } from '@/hooks/driver-onboarding/onboardingTypes';
import { activatePackage, EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { buildDriverRatingIdempotencyKey, type DriverRating } from '@/domain/driverWallet';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '../driverEntitlementPersistence';
import { buildLocalDriverRating, loadStoredDriverRatings, saveDriverRatingOnce } from '../driverRatingPersistence';
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

const driverRating: DriverRating = {
  id: 'rating:ride-1:driver-1',
  rideId: 'ride-1',
  driverId: 'driver-1',
  customerId: 'customer-1',
  stars: 5,
  reviewText: 'Careful driver',
  moderationStatus: 'published',
  createdAt: '2026-06-08T10:00:00.000Z',
  idempotencyKey: buildDriverRatingIdempotencyKey('ride-1'),
  authority: 'local_prototype',
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

  test('persists and removes a driver onboarding draft', async () => {
    const draft = {
      form: { ...INITIAL_DRIVER_ONBOARDING_FORM, nationalId: '1199080012345678' },
      docs: INITIAL_DRIVER_DOCUMENTS,
      selfieUri: 'file:///selfie.jpg',
      acceptedTerms: false,
      step: 2,
      updatedAt: '2026-06-07T12:00:00.000Z',
    };
    await saveStoredDriverOnboardingDraft(draft);
    await expect(loadStoredDriverOnboardingDraft()).resolves.toEqual({ data: draft, source: 'current' });
    await removeStoredDriverOnboardingDraft();
    await expect(loadStoredDriverOnboardingDraft()).resolves.toEqual({ data: null, source: 'missing' });
  });

  test('persists driver ride entitlement and credit ledger securely', async () => {
    const entitlement = activatePackage(EMPTY_DRIVER_ENTITLEMENT, 'growth').entitlement;
    await saveStoredDriverEntitlement(entitlement);
    await expect(loadStoredDriverEntitlement()).resolves.toEqual({ data: entitlement, source: 'current' });
    await expect(AsyncStorage.getItem(STORAGE_KEYS.driverEntitlement)).resolves.toBeNull();
  });

  test('saves a local driver rating securely', async () => {
    const rating = buildLocalDriverRating({
      comment: ' Careful driver ',
      customerId: 'customer-1',
      driverId: 'driver-1',
      now: '2026-06-08T10:00:00.000Z',
      rideId: 'ride-1',
      stars: 5,
    });

    await expect(saveDriverRatingOnce(rating)).resolves.toEqual({ rating, saved: true });
    await expect(loadStoredDriverRatings()).resolves.toEqual({ data: [rating], source: 'current' });
    await expect(AsyncStorage.getItem(STORAGE_KEYS.driverRatings)).resolves.toBeNull();
    expect(rating).toMatchObject({
      rideId: 'ride-1',
      driverId: 'driver-1',
      customerId: 'customer-1',
      stars: 5,
      reviewText: 'Careful driver',
      createdAt: '2026-06-08T10:00:00.000Z',
    });
  });

  test('does not save duplicate ratings for the same completed ride', async () => {
    await expect(saveDriverRatingOnce(driverRating)).resolves.toEqual({ rating: driverRating, saved: true });

    const duplicate = {
      ...driverRating,
      id: 'rating:ride-1:driver-1:duplicate',
      stars: 1,
      reviewText: 'Duplicate',
    } satisfies DriverRating;

    await expect(saveDriverRatingOnce(duplicate)).resolves.toEqual({ rating: driverRating, saved: false });
    await expect(loadStoredDriverRatings()).resolves.toMatchObject({
      data: [driverRating],
    });
  });
});
