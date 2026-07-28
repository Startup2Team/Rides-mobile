import {
  arePickupAndDropoffSame,
  formatHomeHeaderLocation,
  formatReverseGeocodeAddress,
  hasUsablePickup,
  isLatestLocationRequest,
  selectCurrentLocationAddress,
} from '@/utils/locationUtils';
import { KIGALI_CENTER } from '@/types';

describe('current location address formatting', () => {
  it('uses the provider street when reverse geocoding succeeds', () => {
    expect(formatReverseGeocodeAddress({ street: 'KG 9 Avenue' } as never)).toBe('KG 9 Avenue');
  });

  it('uses a neutral fallback when reverse geocoding fails', () => {
    expect(formatReverseGeocodeAddress(null, 'Current location')).toBe('Current location');
  });

  it('shows the neutral fallback after GPS loading completes', () => {
    expect(formatHomeHeaderLocation('Current location', false)).toBe('Current location');
  });

  it('shows a reverse-geocoded street when GPS accuracy is strong', () => {
    expect(
      selectCurrentLocationAddress({ street: 'KG 248 St' } as never, 12),
    ).toBe('KG 248 St');
  });

  it('uses a neutral fallback when GPS accuracy is poor', () => {
    expect(
      selectCurrentLocationAddress({ street: 'KG 183 St' } as never, 65),
    ).toBe('Current location');
  });

  it('uses a neutral fallback when the provider returns no street', () => {
    expect(
      selectCurrentLocationAddress({ city: 'Kigali' } as never, 10),
    ).toBe('Current location');
  });

  it('uses a neutral fallback when provider road fields conflict', () => {
    expect(
      selectCurrentLocationAddress(
        { street: 'KG 183 St', name: '12 KG 248 St' } as never,
        10,
      ),
    ).toBe('Current location');
  });

  it('rejects a stale reverse-geocode request', () => {
    expect(isLatestLocationRequest(1, 2)).toBe(false);
    expect(isLatestLocationRequest(2, 2)).toBe(true);
  });
});

describe('pickup eligibility', () => {
  it('does not treat the initial Kigali camera center as a customer pickup', () => {
    expect(hasUsablePickup({ ...KIGALI_CENTER, address: '', locationType: 'generic' })).toBe(false);
  });

  it('allows a manually selected pickup after GPS failure', () => {
    expect(hasUsablePickup({
      latitude: -1.9536,
      longitude: 30.0606,
      address: 'Selected Pickup',
      locationType: 'precise',
    })).toBe(true);
  });
});

describe('same pickup/dropoff detection', () => {
  it('flags two points within 30m as the same location', () => {
    expect(arePickupAndDropoffSame(
      { latitude: -1.9536, longitude: 30.0606, address: 'KG 17 Ave', locationType: 'precise' },
      { latitude: -1.95361, longitude: 30.06061, address: 'KG 17 Ave', locationType: 'precise' },
    )).toBe(true);
  });

  it('does NOT flag distinct precise drop-offs that merely share a street name', () => {
    // Both reverse-geocode to "KG 17 Ave" but are ~450m apart — a real, distinct trip.
    expect(arePickupAndDropoffSame(
      { latitude: -1.9536, longitude: 30.0606, address: 'KG 17 Ave', locationType: 'precise' },
      { latitude: -1.9576, longitude: 30.0606, address: 'KG 17 Ave', locationType: 'precise' },
    )).toBe(false);
  });

  it('still flags identical free-typed (generic) addresses with placeholder coords', () => {
    expect(arePickupAndDropoffSame(
      { latitude: -1.9536, longitude: 30.0606, address: 'Kacyiru', locationType: 'generic' },
      { latitude: -1.9336, longitude: 30.0806, address: 'Kacyiru', locationType: 'generic' },
    )).toBe(true);
  });
});
