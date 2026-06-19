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
import {
  activatePackage,
  createPackagePurchase,
  EMPTY_DRIVER_ENTITLEMENT,
  getVehicleEntitlement,
  updatePackagePurchaseStatus,
} from '@/domain/driverRidePackages';
import { buildDriverRatingIdempotencyKey, type DriverRating } from '@/domain/driverWallet';
import { buildInitialDriverDocuments } from '@/domain/driverDocuments';
import { loadStoredDriverEntitlement, saveStoredDriverEntitlement } from '../driverEntitlementPersistence';
import { loadStoredDriverDocuments, saveStoredDriverDocuments } from '../driverDocumentsPersistence';
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
    await expect(loadStoredDriverProfile()).resolves.toMatchObject({
      data: {
        ...driverProfile,
        activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
        vehicles: [
          expect.objectContaining({
            id: 'driver-vehicle:moto:rad-001-a',
            status: 'approved',
            vehicleType: 'moto',
            plateNumber: 'RAD 001 A',
            licenseNumber: 'license-1',
          }),
        ],
      },
      source: 'current',
    });
    await expect(AsyncStorage.getItem(STORAGE_KEYS.user)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_KEYS.driverProfile)).resolves.toBeNull();
  });

  test('migrates legacy flat driver profile and copies legacy documents into the primary vehicle', async () => {
    const legacyProfile = {
      ...driverProfile,
      verificationStatus: 'pending_review' as const,
      isVerified: false,
      backendOnlyField: 'preserve-me',
    };
    const documents = buildInitialDriverDocuments(
      {
        ...INITIAL_DRIVER_ONBOARDING_FORM,
        licenseNumber: legacyProfile.licenseNumber,
        nationalId: '1199080012345678',
        licenseExpiryDate: '01/01/2030',
        insuranceExpiryDate: '01/01/2030',
        authorizationExpiryDate: '01/01/2030',
      },
      {
        ...INITIAL_DRIVER_DOCUMENTS,
        license: ['file:///license-front.jpg', 'file:///license-back.jpg'],
        nationalId: ['file:///id-front.jpg', 'file:///id-back.jpg'],
        insurance: ['file:///insurance-front.jpg', null],
        authorization: ['file:///authorization-front.jpg', null],
      },
      '2026-06-16T10:00:00.000Z',
    );
    await saveVersionedStorage(STORAGE_KEYS.driverProfile, legacyProfile);
    await saveStoredDriverDocuments(documents);

    const loaded = await loadStoredDriverProfile();

    expect(loaded).toMatchObject({
      data: {
        backendOnlyField: 'preserve-me',
        activeVehicle: { vehicleId: null },
        vehicles: [
          expect.objectContaining({
            status: 'pending_review',
            documents: expect.objectContaining({
              license: expect.objectContaining({ faces: ['file:///license-front.jpg', 'file:///license-back.jpg'] }),
              insurance: expect.objectContaining({ faces: ['file:///insurance-front.jpg', null] }),
            }),
          }),
        ],
      },
      source: 'legacy',
    });
    await expect(loadStoredDriverDocuments()).resolves.toMatchObject({
      data: {
        license: expect.objectContaining({ faces: ['file:///license-front.jpg', 'file:///license-back.jpg'] }),
        nationalId: expect.objectContaining({ faces: ['file:///id-front.jpg', 'file:///id-back.jpg'] }),
        insurance: expect.objectContaining({ faces: ['file:///insurance-front.jpg', null] }),
        authorization: expect.objectContaining({ faces: ['file:///authorization-front.jpg', null] }),
      },
    });
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

  test('persists vehicle-specific package IDs and ledgers securely', async () => {
    const cabVehicle = { id: 'driver-vehicle:cab:rad-002-a', vehicleType: 'cab' as const };
    const fusoVehicle = { id: 'driver-vehicle:fuso:raf-300-a', vehicleType: 'fuso' as const };
    const cabStarted = createPackagePurchase(EMPTY_DRIVER_ENTITLEMENT, {
      packageId: 'cab_growth',
      provider: 'mtn',
      phoneNumber: '+250788000001',
    }, '2026-06-08T10:00:00.000Z', cabVehicle);
    const cabCompleted = updatePackagePurchaseStatus(
      cabStarted.entitlement,
      cabStarted.purchase.transactionId,
      'successful',
      '2026-06-08T10:01:00.000Z',
      cabVehicle,
    );
    const fusoEntitlement = activatePackage(
      cabCompleted.entitlement,
      'fuso_starter',
      '2026-06-08T10:02:00.000Z',
      fusoVehicle,
    ).entitlement;

    await saveStoredDriverEntitlement(fusoEntitlement);
    const loaded = await loadStoredDriverEntitlement();

    expect(loaded.source).toBe('current');
    expect(getVehicleEntitlement(loaded.data, cabVehicle)).toMatchObject({
      vehicleId: cabVehicle.id,
      vehicleType: 'cab',
      activePackageId: 'cab_growth',
      remainingRideCredits: 5,
      remainingBonusRides: 4,
      purchaseHistory: [expect.objectContaining({ packageId: 'cab_growth', vehicleId: cabVehicle.id })],
    });
    expect(getVehicleEntitlement(loaded.data, fusoVehicle)).toMatchObject({
      vehicleId: fusoVehicle.id,
      vehicleType: 'fuso',
      activePackageId: 'fuso_starter',
      remainingRideCredits: 1,
      remainingBonusRides: 2,
      activations: [expect.objectContaining({ packageId: 'fuso_starter', vehicleId: fusoVehicle.id })],
    });
  });

  test('migrates and persists existing and dynamic package identifiers without data loss', async () => {
    const vehicle = { id: 'driver-vehicle:moto:dynamic', vehicleType: 'moto' as const };
    const entitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleId: vehicle.id,
      vehicleType: vehicle.vehicleType,
      activePackageId: 'moto_premium',
      remainingRideCredits: 240,
      remainingBonusRides: 75,
      activations: [{
        id: 'activation:moto-premium',
        packageId: 'moto_premium',
        packageVersion: 'v9',
        packageName: 'Moto Premium',
        vehicleId: vehicle.id,
        vehicleType: vehicle.vehicleType,
        activatedAt: '2026-06-19T10:02:00.000Z',
        pricePaidRwf: 7_500,
        pricePaid: 7_500,
        ridesGranted: 250,
        bonusRidesGranted: 75,
        purchasedAt: '2026-06-19T10:01:00.000Z',
        creditsGranted: 325,
        authority: 'local_prototype' as const,
      }],
      purchaseHistory: [{
        offerId: 'offer:moto-premium',
        packageId: 'moto_premium',
        packageVersion: 'v9',
        packageName: 'Moto Premium',
        vehicleId: vehicle.id,
        vehicleType: vehicle.vehicleType,
        amount: 7_500,
        pricePaid: 7_500,
        ridesGranted: 250,
        bonusRidesGranted: 75,
        purchasedAt: '2026-06-19T10:01:00.000Z',
        provider: 'mtn' as const,
        phoneNumber: '+250788000000',
        transactionId: 'purchase:moto-premium',
        status: 'successful' as const,
        createdAt: '2026-06-19T10:01:00.000Z',
      }],
      vehicleEntitlements: [],
      updatedAt: '2026-06-19T10:02:00.000Z',
      authority: 'local_prototype' as const,
    };

    await saveStoredDriverEntitlement(entitlement);
    const loaded = await loadStoredDriverEntitlement();

    expect(loaded.data).toMatchObject({
      activePackageId: 'moto_premium',
      remainingRideCredits: 240,
      remainingBonusRides: 75,
      activations: [expect.objectContaining({
        packageId: 'moto_premium',
        packageName: 'Moto Premium',
      })],
      purchaseHistory: [expect.objectContaining({
        packageId: 'moto_premium',
        packageVersion: 'v9',
        ridesGranted: 250,
        bonusRidesGranted: 75,
      })],
    });
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
