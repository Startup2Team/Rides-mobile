import { createAppQueryClient } from '../client';
import { queryPolicies } from '../policies';
import { driverKeys, notificationKeys, packageKeys, paymentKeys, profileKeys, rideKeys, savedLocationKeys, searchKeys } from '../keys';

describe('query foundation', () => {
  test('creates a shared query client with default policies', () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries).toEqual(expect.objectContaining({
      retry: 2,
      networkMode: 'online',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      staleTime: 0,
      gcTime: 1000 * 60 * 30,
    }));
    expect(defaults.mutations).toEqual(expect.objectContaining({
      retry: 1,
      networkMode: 'online',
    }));
  });

  test('query key factories are strongly shaped and unique', () => {
    const profileCurrent: readonly ['profile', 'current'] = profileKeys.current();
    const profilePhoto: readonly ['profile', 'photo'] = profileKeys.photo();
    const savedLocationList: readonly ['saved-locations', 'list', string] = savedLocationKeys.list('user-1');
    const savedLocationDetail: readonly ['saved-locations', 'detail', string] = savedLocationKeys.detail('home');
    const rideActive: readonly ['ride', 'active'] = rideKeys.active();
    const rideHistory: readonly ['ride', 'history', string] = rideKeys.history('user-1');
    const driverProfile: readonly ['driver', 'profile'] = driverKeys.profile();
    const driverVehicles = driverKeys.vehicles('user-1');
    const driverVehicle: readonly ['driver', 'vehicle', string] = driverKeys.vehicle('vehicle-1');
    const driverPackages: readonly ['driver', 'packages'] = driverKeys.packages();
    const notificationList: readonly ['notifications', 'list'] = notificationKeys.list();
    const paymentMethods: readonly ['payments', 'methods'] = paymentKeys.methods();
    const packageCatalog: readonly ['packages', 'catalog', string] = packageKeys.catalog('moto');
    const autocomplete = searchKeys.autocomplete('kigali');
    const reverseGeocode = searchKeys.reverseGeocode({ latitude: -1.94, longitude: 30.06 });

    expect(profileCurrent).toEqual(['profile', 'current']);
    expect(profilePhoto).toEqual(['profile', 'photo']);
    expect(savedLocationList).toEqual(['saved-locations', 'list', 'user-1']);
    expect(savedLocationDetail).toEqual(['saved-locations', 'detail', 'home']);
    expect(rideActive).toEqual(['ride', 'active']);
    expect(rideHistory).toEqual(['ride', 'history', 'user-1']);
    expect(driverProfile).toEqual(['driver', 'profile']);
    expect(driverVehicles).toEqual(['driver', 'user-1', 'vehicles']);
    expect(driverVehicle).toEqual(['driver', 'vehicle', 'vehicle-1']);
    expect(driverPackages).toEqual(['driver', 'packages']);
    expect(notificationList).toEqual(['notifications', 'list']);
    expect(paymentMethods).toEqual(['payments', 'methods']);
    expect(packageCatalog).toEqual(['packages', 'catalog', 'moto']);
    expect(autocomplete[0]).toBe('search');
    expect(reverseGeocode[0]).toBe('search');

    const keys = [
      profileCurrent,
      profilePhoto,
      savedLocationList,
      savedLocationDetail,
      rideActive,
      rideHistory,
      driverProfile,
      driverVehicles,
      driverVehicle,
      driverPackages,
      notificationList,
      paymentMethods,
      packageCatalog,
      autocomplete,
      reverseGeocode,
    ];
    expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(keys.length);
  });

  test('defines cache policies for all supported domains', () => {
    expect(Object.keys(queryPolicies).sort()).toEqual([
      'activeRide',
      'driverProfile',
      'driverVehicles',
      'driverVehicle',
      'notifications',
      'packages',
      'paymentMethods',
      'profile',
      'rideHistory',
      'reverseGeocode',
      'savedLocations',
      'searchAutocomplete',
    ].sort());

    for (const policy of Object.values(queryPolicies)) {
      expect(policy).toEqual(expect.objectContaining({
        staleTime: expect.any(Number),
        gcTime: expect.any(Number),
        refetchOnWindowFocus: expect.any(Boolean),
        refetchOnReconnect: expect.any(Boolean),
        refetchOnMount: expect.anything(),
        retry: expect.any(Number),
        retryDelayMs: expect.any(Number),
        networkMode: 'online',
      }));
    }
  });
});
