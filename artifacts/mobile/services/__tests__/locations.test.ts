import * as locations from '../locations';

const mockCalls: Array<{ method: string; path: string; options?: any }> = [];
let mockNextResponse: any = { data: { data: {} } };

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    get: (path: string, options?: any) => { mockCalls.push({ method: 'GET', path, options }); return Promise.resolve(mockNextResponse); },
    post: (path: string, options?: any) => { mockCalls.push({ method: 'POST', path, options }); return Promise.resolve(mockNextResponse); },
    delete: (path: string, options?: any) => { mockCalls.push({ method: 'DELETE', path, options }); return Promise.resolve(mockNextResponse); },
  }),
}));

beforeEach(() => { mockCalls.length = 0; });

describe('locations service (real backend contract)', () => {
  test('landmarks unwrap the nested list and map to domain', async () => {
    mockNextResponse = { data: { data: { landmarks: [
      { id: 'l1', name: 'Kigali Convention Centre', category: 'landmark', lat: -1.95, lng: 30.09, geohash6: 'kxxxxx' },
    ] } } };
    const result = await locations.listLandmarks();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/locations/landmarks' });
    expect(result).toEqual([{
      id: 'l1', name: 'Kigali Convention Centre', category: 'landmark',
      latitude: -1.95, longitude: 30.09, geohash6: 'kxxxxx',
    }]);
  });

  test('admin units omit parent_id at the root and send it for a drill-down', async () => {
    mockNextResponse = { data: { data: { admin_units: null } } };
    await locations.listAdminUnits();
    expect(mockCalls[0].path).toBe('/v1/locations/admin-units');

    await locations.listAdminUnits('unit-1');
    expect(mockCalls[1].path).toBe('/v1/locations/admin-units?parent_id=unit-1');
  });

  test('admin unit search passes q and level, mapping parent_id to parentId', async () => {
    mockNextResponse = { data: { data: { admin_units: [
      { id: 'u1', parent_id: 'p1', level: 'sector', name: 'Remera', path: 'Kigali City > Gasabo > Remera' },
    ] } } };
    const result = await locations.searchAdminUnits('rem', 'sector');
    expect(mockCalls[0].path).toBe('/v1/locations/admin-units/search?q=rem&level=sector');
    expect(result[0]).toEqual({
      id: 'u1', parentId: 'p1', level: 'sector', name: 'Remera',
      path: 'Kigali City > Gasabo > Remera',
    });
  });

  test('suggestions split the four lists onto the domain shape', async () => {
    mockNextResponse = { data: { data: {
      saved_locations: [{ id: 's1', label: 'Home', address: 'KG 10', lat: -1.9, lng: 30.0, created_at: 'a', updated_at: 'b' }],
      recent_locations: [{ id: 'r1', address: 'Kimironko', lat: -1.95, lng: 30.12, use_count: 2, last_used_at: 'c' }],
      recent_destinations: [{ address: 'Nyabugogo', lat: -1.94, lng: 30.04 }],
      landmarks: [{ id: 'l1', name: 'Serena', category: 'hotel', lat: -1.95, lng: 30.06, geohash6: 'kxxxxx' }],
    } } };
    const result = await locations.fetchLocationSuggestions();
    expect(mockCalls[0].path).toBe('/v1/locations/suggestions');
    expect(result.savedLocations[0]).toMatchObject({ id: 's1', label: 'Home', lat: -1.9 });
    expect(result.recentLocations[0]).toMatchObject({ id: 'r1', latitude: -1.95, useCount: 2 });
    expect(result.recentDestinations[0]).toEqual({ address: 'Nyabugogo', latitude: -1.94, longitude: 30.04 });
    expect(result.landmarks[0]).toMatchObject({ id: 'l1', latitude: -1.95 });
  });

  test('recent locations round-trip: list, record, delete', async () => {
    mockNextResponse = { data: { data: { recent_locations: [
      { id: 'r1', address: 'Kimironko', lat: -1.95, lng: 30.12, use_count: 2, last_used_at: 'c' },
    ] } } };
    const list = await locations.listRecentLocations();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/locations/recent' });
    expect(list[0]).toMatchObject({ id: 'r1', address: 'Kimironko', lastUsedAt: 'c' });

    await locations.recordRecentLocation({ address: 'Kimironko', latitude: -1.95, longitude: 30.12 });
    expect(mockCalls[1]).toMatchObject({ method: 'POST', path: '/v1/locations/recent' });
    expect(mockCalls[1].options.body).toEqual({ address: 'Kimironko', lat: -1.95, lng: 30.12 });

    await locations.deleteRecentLocation('r1');
    expect(mockCalls[2]).toMatchObject({ method: 'DELETE', path: '/v1/locations/recent/r1' });
  });

  test('route lookup sends the backend transport code and maps a hit', async () => {
    mockNextResponse = { data: { data: { route: {
      cache_key: 'a:b:MOTO_BIKE', origin_geohash: 'a', dest_geohash: 'b',
      distance_km: 4.2, duration_minutes: 13, avg_fare_rwf: 1800, use_count: 7,
    } } } };
    const result = await locations.fetchCachedRoute({
      origin: { latitude: -1.94, longitude: 30.06 },
      destination: { latitude: -1.95, longitude: 30.12 },
      vehicleType: 'moto',
    });
    expect(mockCalls[0].path).toBe(
      '/v1/locations/route?pickup_lat=-1.94&pickup_lng=30.06&dest_lat=-1.95&dest_lng=30.12&vehicle_type=MOTO_BIKE',
    );
    expect(result).toEqual({
      cacheKey: 'a:b:MOTO_BIKE', distanceKm: 4.2, durationMinutes: 13,
      avgFareRwf: 1800, useCount: 7,
    });
  });

  test('a route cache miss resolves to null rather than throwing', async () => {
    mockNextResponse = { data: { data: { route: null } } };
    await expect(locations.fetchCachedRoute({
      origin: { latitude: -1.94, longitude: 30.06 },
      destination: { latitude: -1.95, longitude: 30.12 },
      vehicleType: 'cab',
    })).resolves.toBeNull();
  });

  test('recording a route sends snake_case metrics', async () => {
    mockNextResponse = { data: { data: { route: null } } };
    await locations.recordRouteMetrics({
      origin: { latitude: -1.94, longitude: 30.06 },
      destination: { latitude: -1.95, longitude: 30.12 },
      vehicleType: 'hilux',
      distanceKm: 4.2,
      durationMinutes: 13,
    });
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/locations/route' });
    expect(mockCalls[0].options.body).toEqual({
      pickup_lat: -1.94, pickup_lng: 30.06, dest_lat: -1.95, dest_lng: 30.12,
      vehicle_type: 'LIGHT_HILUX', distance_km: 4.2, duration_minutes: 13,
    });
  });
});

describe('locations search adapters', () => {
  const landmarks: locations.Landmark[] = [
    { id: 'l1', name: 'Serena Hotel', category: 'hotel', latitude: -1.95, longitude: 30.06, geohash6: 'a' },
    { id: 'l2', name: 'Hotel des Mille Collines', category: 'hotel', latitude: -1.95, longitude: 30.06, geohash6: 'b' },
    { id: 'l3', name: 'Kimironko Market', category: 'market', latitude: -1.95, longitude: 30.12, geohash6: 'c' },
  ];

  test('filterLandmarks ignores queries under two characters', () => {
    expect(locations.filterLandmarks(landmarks, 'h')).toEqual([]);
  });

  test('filterLandmarks matches name or category and ranks prefixes first', () => {
    const result = locations.filterLandmarks(landmarks, 'hotel');
    expect(result.map(item => item.id)).toEqual(['l2', 'l1']);
  });

  test('landmarkToSuggestion produces a geocoder-shaped result', () => {
    expect(locations.landmarkToSuggestion(landmarks[2])).toEqual({
      id: 'landmark-l3',
      place_name: 'Kimironko Market',
      title: 'Kimironko Market',
      subtitle: 'market',
      coords: { latitude: -1.95, longitude: 30.12 },
      featureType: 'poi',
    });
  });

  test('adminUnitSearchText reverses the path so the geocoder gets it narrowest-first', () => {
    expect(locations.adminUnitSearchText({
      id: 'u1', parentId: 'p1', level: 'sector', name: 'Remera',
      path: 'Kigali City > Gasabo > Remera',
    })).toBe('Remera, Gasabo, Kigali City');
  });
});
