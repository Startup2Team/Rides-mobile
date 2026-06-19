import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DRIVER_RIDE_PACKAGE_CATALOG, getPackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import {
  loadLockedPackageOffer,
  saveLockedPackageOffer,
} from '../lockedPackageOfferPersistence';

describe('locked package offer persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
  });

  function offer() {
    const resolved = resolvePackageOffer({
      package: getPackageCatalogEntry('growth', 'moto')!,
      vehicleType: 'moto',
      activeCampaigns: [],
      now: new Date('2026-06-19T10:00:00.000Z'),
    });
    return {
      resolved,
      locked: createPackageOfferSnapshot(
      resolved,
      { vehicleId: 'vehicle-moto-1', vehicleType: 'moto' },
      new Date('2026-06-19T10:00:00.000Z'),
      undefined,
      { ownerUserId: 'driver-1' },
      ),
    };
  }

  test('loads an immutable offer by ID for its owner and vehicle', async () => {
    const { locked, resolved } = offer();
    await saveLockedPackageOffer(locked, DRIVER_RIDE_PACKAGE_CATALOG, resolved);

    await expect(loadLockedPackageOffer(locked.offerId, {
      ownerUserId: 'driver-1',
      vehicle: { vehicleId: 'vehicle-moto-1', vehicleType: 'moto' },
      now: new Date('2026-06-19T10:01:00.000Z'),
    })).resolves.toEqual({ offer: locked, failure: null });
  });

  test('rejects mutation of an existing locked offer ID', async () => {
    const { locked, resolved } = offer();
    await saveLockedPackageOffer(locked, DRIVER_RIDE_PACKAGE_CATALOG, resolved);

    await expect(saveLockedPackageOffer(
      { ...locked, ridesGranted: locked.ridesGranted + 999 },
      DRIVER_RIDE_PACKAGE_CATALOG,
      { ...resolved, ridesGranted: resolved.ridesGranted + 999 },
    )).rejects.toThrow('cannot be changed');
  });

  test('blocks expired, wrong-owner, and wrong-vehicle offers', async () => {
    const { locked, resolved } = offer();
    await saveLockedPackageOffer(locked, DRIVER_RIDE_PACKAGE_CATALOG, resolved);

    await expect(loadLockedPackageOffer(locked.offerId, {
      ownerUserId: 'driver-2',
      now: new Date('2026-06-19T10:01:00.000Z'),
    })).resolves.toMatchObject({ failure: 'owner_mismatch' });
    await expect(loadLockedPackageOffer(locked.offerId, {
      ownerUserId: 'driver-1',
      vehicle: { vehicleId: 'vehicle-cab-1', vehicleType: 'cab' },
      now: new Date('2026-06-19T10:01:00.000Z'),
    })).resolves.toMatchObject({ failure: 'vehicle_mismatch' });
    await expect(loadLockedPackageOffer(locked.offerId, {
      ownerUserId: 'driver-1',
      now: new Date('2026-06-19T10:16:00.000Z'),
    })).resolves.toMatchObject({ failure: 'expired' });
  });

  test('refuses to lock an offer whose package version is absent from the catalog', async () => {
    const { locked: original, resolved } = offer();
    const locked = { ...original, packageVersion: 'unknown-version' };

    await expect(saveLockedPackageOffer(locked, DRIVER_RIDE_PACKAGE_CATALOG, {
      ...resolved,
      packageVersion: 'unknown-version',
    }))
      .rejects.toThrow('no longer available');
  });
});
