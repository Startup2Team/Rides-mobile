jest.mock('@/constants/savedLocations', () => ({
  MAX_SAVED_LOCATIONS: 20,
}));

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(() =>
    Promise.resolve([{ name: 'Kigali', street: 'KG 15 Ave', city: 'Kigali', region: 'Kigali City' }]),
  ),
}));

import { savedLocationsRepository, paymentRepository, notificationRepository, rideRepository, searchRepository, mapRepository, authRepository, profileRepository, driverRepository, vehicleRepository } from '@/data/repositories';
import { createListenerSet } from '@/state/storeUtils';
import { KIGALI_CENTER } from '@/types';

describe('repository layer', () => {
  afterEach(async () => {
    await savedLocationsRepository.clearSavedLocations();
    await paymentRepository.savePaymentMethods([]);
    await notificationRepository.clear();
    await searchRepository.clearRecentQueries();
  });

  test('saved locations repository preserves existing behavior', async () => {
    await savedLocationsRepository.clearSavedLocations();
    const saved = await savedLocationsRepository.saveLocation({ ...KIGALI_CENTER, address: 'Nyamirambo' }, 'Home');
    expect(saved).toBe(true);
    const locations = await savedLocationsRepository.listSavedLocations();
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ label: 'Home', address: 'Nyamirambo' });
  });

  test('payment and notification repositories proxy the existing local sources', async () => {
    await paymentRepository.savePaymentMethods([{ id: 'cash', provider: 'cash', label: 'Cash', isDefault: true }]);
    expect(await paymentRepository.listPaymentMethods()).toHaveLength(1);

    await notificationRepository.clear();
    await notificationRepository.markRead('ride-1');
    const readState = await notificationRepository.getReadState();
    expect(readState.read.has('ride-1')).toBe(true);
    expect(readState.unread.has('ride-1')).toBe(false);
  });

  test('search and map repositories are callable and isolated from screens', async () => {
    expect(await searchRepository.loadRecentQueries()).toEqual([]);
    await searchRepository.saveRecentQuery('Kimironko');
    expect(await searchRepository.loadRecentQueries()).toEqual(['Kimironko']);

    const reverse = await mapRepository.reverseGeocode(KIGALI_CENTER);
    expect(reverse).toMatchObject({
      latitude: KIGALI_CENTER.latitude,
      longitude: KIGALI_CENTER.longitude,
      address: 'Kigali, KG 15 Ave, Kigali, Kigali City',
    });
  });

  test('auth, profile, ride, driver, and vehicle repositories are exported as single entry points', async () => {
    expect(authRepository).toBeDefined();
    expect(profileRepository).toBeDefined();
    expect(rideRepository).toBeDefined();
    expect(driverRepository).toBeDefined();
    expect(vehicleRepository).toBeDefined();
  });

  test('listener helpers remain available for draft-only state', () => {
    const listeners = createListenerSet<string>();
    const seen: string[] = [];
    listeners.add(value => seen.push(value));
    listeners.notify('a');
    listeners.notify('b');
    expect(seen).toEqual(['a', 'b']);
  });
});
